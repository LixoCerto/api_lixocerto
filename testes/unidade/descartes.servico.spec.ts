import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ServicoDesafios } from '../../src/modulos/desafios/desafios.servico.js';
import { ServicoGamificacao } from '../../src/modulos/gamificacao/gamificacao.servico.js';
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
};

describe('ServicoDescartes', () => {
  it('nega status de revisão inválido antes de acessar o repositório', async () => {
    const repositorio = { revisar: vi.fn() } as unknown as RepositorioDescartes;
    const servico = new ServicoDescartes(repositorio, {} as ServicoGamificacao, {} as ServicoDesafios);

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
    const servico = new ServicoDescartes(repositorio, gamificacao, desafios);

    await expect(servico.revisar('revisor-1', 'registro-1', 'aprovado')).resolves.toBe(registro);
    expect(gamificacao.concederPontos).toHaveBeenCalledWith('usuario-1', 20, 'descarte_validado', 'registro-1', 'papel', transaction);
    expect(desafios.processarProgresso).toHaveBeenCalledWith('usuario-1');
  });

  it('não concede pontos nem dispara metas quando o descarte é rejeitado', async () => {
    const rejeitado = { ...registro, status: 'rejeitado' as const, pontosConcedidos: 0 };
    const gamificacao = { concederPontos: vi.fn() } as unknown as ServicoGamificacao;
    const desafios = { processarProgresso: vi.fn() } as unknown as ServicoDesafios;
    const repositorio = { revisar: vi.fn().mockResolvedValue(rejeitado) } as unknown as RepositorioDescartes;
    const servico = new ServicoDescartes(repositorio, gamificacao, desafios);

    await expect(servico.revisar('revisor-1', 'registro-1', 'rejeitado')).resolves.toBe(rejeitado);
    expect(gamificacao.concederPontos).not.toHaveBeenCalled();
    expect(desafios.processarProgresso).not.toHaveBeenCalled();
  });
});
