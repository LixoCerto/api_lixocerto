import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ServicoDesafios } from '../../src/modulos/desafios/desafios.servico.js';
import { ServicoGamificacao } from '../../src/modulos/gamificacao/gamificacao.servico.js';
import { ArmazenamentoEvidenciasDescartes } from '../../src/modulos/pontos_coleta/armazenamento_evidencias_descartes.servico.js';
import { RegistroDescarte, RepositorioDescartes } from '../../src/modulos/pontos_coleta/descartes.repositorio.js';
import { ServicoDescartes } from '../../src/modulos/pontos_coleta/descartes.servico.js';

const registro: RegistroDescarte = {
  idRegistro: 'registro-1',
  idUsuario: 'usuario-1',
  idPontoColeta: 'ponto-1',
  nomePontoColeta: 'Ponto verificado',
  cidadePontoColeta: 'Cidade',
  categoriaMaterial: 'papel',
  quantidade: 1,
  relato: '',
  status: 'aprovado',
  dataRegistro: '2026-09-30T12:00:00.000Z',
  dataRevisao: '2026-09-30T12:30:00.000Z',
  pontosConcedidos: 20,
  evidenciaDisponivel: true,
  temCheckin: true,
  distanciaCheckinMetros: 4,
  precisaoCheckinMetros: 5,
};

function criarArmazenamento() {
  return {
    armazenarImagem: vi.fn().mockResolvedValue({ chave: 'foto-privada', hashSha256: 'a'.repeat(64), tamanhoBytes: 100 }),
    lerImagem: vi.fn(),
    removerImagem: vi.fn().mockResolvedValue(undefined),
  } as unknown as ArmazenamentoEvidenciasDescartes;
}

describe('ServicoDescartes', () => {
  it('nega status de revisão inválido antes de acessar o repositório', async () => {
    const repositorio = { revisar: vi.fn() } as unknown as RepositorioDescartes;
    const servico = new ServicoDescartes(repositorio, {} as ServicoGamificacao, {} as ServicoDesafios, criarArmazenamento());

    expect(() => servico.revisar('revisor-1', 'registro-1', 'pendente')).toThrow(BadRequestException);
    expect(repositorio.revisar).not.toHaveBeenCalled();
  });

  it('concede pontos na transação de aprovação e atualiza metas após o commit', async () => {
    const transaction = {};
    const gamificacao = { concederPontos: vi.fn().mockResolvedValue({ aplicado: true }) } as unknown as ServicoGamificacao;
    const desafios = { processarProgresso: vi.fn().mockResolvedValue(undefined) } as unknown as ServicoDesafios;
    const repositorio = {
      revisar: vi.fn(async (_dados: unknown, aoAprovar: (item: RegistroDescarte, tx: never) => Promise<unknown>) => {
        await aoAprovar(registro, transaction as never);
        return registro;
      }),
    } as unknown as RepositorioDescartes;
    const servico = new ServicoDescartes(repositorio, gamificacao, desafios, criarArmazenamento());

    await expect(servico.revisar('revisor-1', 'registro-1', 'aprovado')).resolves.toBe(registro);
    expect(gamificacao.concederPontos).toHaveBeenCalledWith('usuario-1', 20, 'descarte_validado', 'registro-1', 'papel', transaction);
    expect(desafios.processarProgresso).toHaveBeenCalledWith('usuario-1');
  });

  it('não concede pontos nem dispara metas quando o descarte é rejeitado', async () => {
    const rejeitado = { ...registro, status: 'rejeitado' as const, pontosConcedidos: 0 };
    const gamificacao = { concederPontos: vi.fn() } as unknown as ServicoGamificacao;
    const desafios = { processarProgresso: vi.fn() } as unknown as ServicoDesafios;
    const repositorio = { revisar: vi.fn().mockResolvedValue(rejeitado) } as unknown as RepositorioDescartes;
    const servico = new ServicoDescartes(repositorio, gamificacao, desafios, criarArmazenamento());

    await expect(servico.revisar('revisor-1', 'registro-1', 'rejeitado')).resolves.toBe(rejeitado);
    expect(gamificacao.concederPontos).not.toHaveBeenCalled();
    expect(desafios.processarProgresso).not.toHaveBeenCalled();
  });

  it('rejeita check-in com precisão de GPS acima de 10 m antes de chamar o repositório', async () => {
    const repositorio = { iniciarCheckin: vi.fn() } as unknown as RepositorioDescartes;
    const servico = new ServicoDescartes(repositorio, {} as ServicoGamificacao, {} as ServicoDesafios, criarArmazenamento());

    await expect(servico.iniciarCheckin('usuario-1', {
      idPontoColeta: '123e4567-e89b-12d3-a456-426614174000', latitude: -7.115, longitude: -34.86, precisaoMetros: 10.01,
    })).rejects.toThrow('precisão do GPS precisa ser de até 10 m');
    expect(repositorio.iniciarCheckin).not.toHaveBeenCalled();
  });

  it('comprime e armazena cada foto antes de persistir metadados sem enviar bytes ao repositório', async () => {
    const armazenamento = criarArmazenamento();
    const repositorio = { concluir: vi.fn().mockResolvedValue([registro]) } as unknown as RepositorioDescartes;
    const servico = new ServicoDescartes(repositorio, {} as ServicoGamificacao, {} as ServicoDesafios, armazenamento);
    const imagem = new Uint8Array([1, 2, 3, 4]);

    await expect(servico.concluir('usuario-1', '123e4567-e89b-12d3-a456-426614174000', [
      { categoria: 'papel', relato: 'separado', foto: imagem },
    ])).resolves.toEqual([registro]);
    expect(armazenamento.armazenarImagem).toHaveBeenCalledWith(imagem);
    const dadosPersistidos = (repositorio.concluir as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(dadosPersistidos.itens[0]).toMatchObject({ categoria: 'papel', relato: 'separado', chaveFoto: 'foto-privada' });
    expect(dadosPersistidos.itens[0]).not.toHaveProperty('foto');
  });

  it('remove foto privada se o check-in não puder ser concluído no banco', async () => {
    const armazenamento = criarArmazenamento();
    const repositorio = { concluir: vi.fn().mockResolvedValue(null) } as unknown as RepositorioDescartes;
    const servico = new ServicoDescartes(repositorio, {} as ServicoGamificacao, {} as ServicoDesafios, armazenamento);

    await expect(servico.concluir('usuario-1', '123e4567-e89b-12d3-a456-426614174000', [
      { categoria: 'papel', relato: '', foto: new Uint8Array([1]) },
    ])).resolves.toBeNull();
    expect(armazenamento.removerImagem).toHaveBeenCalledWith('foto-privada');
  });
});
