import { describe, expect, it, vi } from 'vitest';
import { ServicoRateLimit } from '../../src/infraestrutura/cache/rate_limit.servico.js';
import { RepositorioProgresso } from '../../src/modulos/gamificacao/progresso.repositorio.js';
import { ServicoGamificacao } from '../../src/modulos/gamificacao/gamificacao.servico.js';
import { RepositorioAuditoria } from '../../src/modulos/auditoria/auditoria.repositorio.js';
import { ServicoAuditoria } from '../../src/modulos/auditoria/auditoria.servico.js';
import { RepositorioDesafios } from '../../src/modulos/desafios/desafios.repositorio.js';
import { ServicoDesafios } from '../../src/modulos/desafios/desafios.servico.js';

describe('auditoria, rate limit e desafios', () => {
  it('remove valores sensíveis dos detalhes de auditoria', async () => {
    const repositorio = { registrar: vi.fn().mockResolvedValue({}) } as unknown as RepositorioAuditoria;
    const servico = new ServicoAuditoria(repositorio);

    await servico.registrar({
      tipoEvento: 'login',
      idCorrelacao: 'correlacao-1',
      detalhesEvento: { token: 'nao-persistir', resultado: 'ok', objeto: { interno: true } },
    });

    expect(repositorio.registrar).toHaveBeenCalledWith(expect.objectContaining({
      detalhesEvento: { token: '[REDACTED]', resultado: 'ok', objeto: { interno: true } },
    }), undefined);
  });

  it('falha fechado quando Redis não está disponível para rate limiting', async () => {
    const servico = new ServicoRateLimit(null);
    await expect(servico.permitir('chave', 2, 60)).resolves.toEqual({
      permitido: false,
      restante: 0,
      disponivel: false,
    });
  });

  it('mantém o domínio de desafios vazio sem persistência', async () => {
    const auditoria = new ServicoAuditoria({ registrar: vi.fn().mockResolvedValue(null) } as unknown as RepositorioAuditoria);
    const servico = new ServicoDesafios(
      new RepositorioDesafios(null),
      new ServicoGamificacao({} as RepositorioProgresso),
      auditoria,
    );

    await expect(servico.listar(null)).resolves.toEqual([]);
    await expect(servico.listarGestao({ status: 'todos' })).resolves.toEqual({ desafios: [], quantidadeTotal: 0 });
    await expect(servico.participar('usuario', 'desafio', 'correlacao')).resolves.toBeNull();
  });

  it('valida conteúdo e mantém novos desafios como rascunho', async () => {
    const servico = new ServicoDesafios(
      new RepositorioDesafios(null),
      new ServicoGamificacao({} as RepositorioProgresso),
      new ServicoAuditoria({ registrar: vi.fn() } as unknown as RepositorioAuditoria),
    );

    await expect(servico.criar({
      nomeDesafio: 'Separação consciente',
      descricaoDesafio: 'Separe resíduos para descarte correto.',
      tipoAcao: 'separacao_residuos',
      metaQuantidade: 5,
      quantidadePontos: 100,
      dataInicio: new Date(),
      dataFim: null,
      periodicidade: 'unica',
      criterios: [],
    })).resolves.toBeNull();
    expect(() => servico.criar({
      nomeDesafio: '',
      descricaoDesafio: 'Descrição',
      tipoAcao: 'separacao residuos',
      metaQuantidade: 0,
      quantidadePontos: -1,
      dataInicio: new Date(Number.NaN),
      dataFim: null,
      periodicidade: 'unica',
      criterios: [],
    })).toThrow('Nome obrigatório');
  });
});
