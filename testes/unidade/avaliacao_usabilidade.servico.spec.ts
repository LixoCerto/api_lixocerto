import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepositorioAvaliacaoUsabilidade } from '../../src/modulos/avaliacao_usabilidade/avaliacao_usabilidade.repositorio.js';
import { ServicoAvaliacaoUsabilidade } from '../../src/modulos/avaliacao_usabilidade/avaliacao_usabilidade.servico.js';

describe('ServicoAvaliacaoUsabilidade', () => {
  afterEach(() => {
    delete process.env.SEGREDO_HASH_PARTICIPANTE;
  });

  it('calcula escore SUS perfeito como 100', () => {
    const repositorio = {} as RepositorioAvaliacaoUsabilidade;
    const servico = new ServicoAvaliacaoUsabilidade(repositorio);
    expect(servico.calcularPontuacao([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
  });

  it('rejeita avaliação sem consentimento', async () => {
    const repositorio = { salvar: vi.fn() } as unknown as RepositorioAvaliacaoUsabilidade;
    const servico = new ServicoAvaliacaoUsabilidade(repositorio);
    const resposta = await servico.enviar('participante-1', false, [5, 1, 5, 1, 5, 1, 5, 1, 5, 1]);

    expect(resposta.avaliacaoAceita).toBe(false);
    expect(repositorio.salvar).not.toHaveBeenCalled();
  });

  it('salva somente o fluxo anonimizado quando o segredo está configurado', async () => {
    process.env.SEGREDO_HASH_PARTICIPANTE = 'segredo-de-teste';
    const repositorio = { salvar: vi.fn().mockResolvedValue(undefined) } as unknown as RepositorioAvaliacaoUsabilidade;
    const servico = new ServicoAvaliacaoUsabilidade(repositorio);
    const resposta = await servico.enviar('participante-1', true, [5, 1, 5, 1, 5, 1, 5, 1, 5, 1]);

    expect(resposta.avaliacaoAceita).toBe(true);
    expect(repositorio.salvar).toHaveBeenCalledOnce();
    expect(String((repositorio.salvar as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])).toMatch(/^[a-f0-9]{64}$/);
  });
});
