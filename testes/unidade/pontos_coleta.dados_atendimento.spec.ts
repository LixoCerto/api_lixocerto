import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ServicoPontosColeta } from '../../src/modulos/pontos_coleta/pontos_coleta.servico.js';
import type { DadosPontoColeta, RepositorioPontosColeta } from '../../src/modulos/pontos_coleta/pontos_coleta.repositorio.js';

function criarServico() {
  const repositorio = {
    criar: vi.fn().mockResolvedValue(null),
  } as unknown as RepositorioPontosColeta;
  return { servico: new ServicoPontosColeta(repositorio), repositorio };
}

function dadosBase(): DadosPontoColeta {
  return {
    nomePontoColeta: 'Ecocentro',
    enderecoPontoColeta: 'Rua Verde, 10',
    cepPontoColeta: '58000000',
    cidadePontoColeta: 'João Pessoa',
    estadoPontoColeta: 'pb',
    latitudePontoColeta: -7.1,
    longitudePontoColeta: -34.8,
    categoriasAceitas: ['Recicláveis'],
  };
}

describe('dados de atendimento dos pontos de coleta', () => {
  it('normaliza horário, telefone e URL HTTP(S) antes de persistir', async () => {
    const { servico, repositorio } = criarServico();
    await servico.criar({
      ...dadosBase(),
      horarioFuncionamento: '  Seg. a sex., 8h às 17h  ',
      telefoneContato: ' (83) 3333-4444 ',
      urlInformacoes: ' https://exemplo.gov.br/coleta ' ,
    });

    expect(repositorio.criar).toHaveBeenCalledWith(expect.objectContaining({
      horarioFuncionamento: 'Seg. a sex., 8h às 17h',
      telefoneContato: '(83) 3333-4444',
      urlInformacoes: 'https://exemplo.gov.br/coleta',
      estadoPontoColeta: 'PB',
    }));
  });

  it('recusa esquemas não HTTP(S) e URLs com credenciais embutidas', async () => {
    const { servico, repositorio } = criarServico();
    expect(() => servico.criar({ ...dadosBase(), urlInformacoes: 'javascript:alert(1)' }))
      .toThrow(BadRequestException);
    expect(() => servico.criar({ ...dadosBase(), urlInformacoes: 'https://usuario:senha@exemplo.gov.br' }))
      .toThrow(BadRequestException);
    expect(repositorio.criar).not.toHaveBeenCalled();
  });

  it('recusa horário excessivo e telefone inválido', async () => {
    const { servico, repositorio } = criarServico();
    expect(() => servico.criar({ ...dadosBase(), horarioFuncionamento: 'x'.repeat(501) }))
      .toThrow(BadRequestException);
    expect(() => servico.criar({ ...dadosBase(), telefoneContato: 'telefone' }))
      .toThrow(BadRequestException);
    expect(repositorio.criar).not.toHaveBeenCalled();
  });
});
