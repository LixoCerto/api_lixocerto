import { describe, expect, it, vi } from 'vitest';
import { ServicoIdentidade } from '../../src/modulos/identidade/identidade.servico.js';
import { ServicoPerfil } from '../../src/modulos/perfil/perfil.servico.js';
import { ServicoSessoes } from '../../src/modulos/sessoes/sessoes.servico.js';

describe('identidade, perfil e sessoes', () => {
  it('retorna vazio sem banco para identidade e sessões', async () => {
    await expect(new ServicoIdentidade(null).obterPorIdExterno('externo')).resolves.toBeNull();
    const identidade = new ServicoIdentidade(null);
    await expect(new ServicoSessoes(null, identidade).listar('externo')).resolves.toEqual([]);
    await expect(new ServicoSessoes(null, identidade).revogarTodas('externo')).resolves.toBe(0);
  });

  it('rejeita nome de perfil inválido antes de acessar o banco', async () => {
    const identidade = { exigirAtivo: vi.fn() } as unknown as ServicoIdentidade;
    const perfil = new ServicoPerfil(null, identidade);
    await expect(perfil.atualizarNome('externo', ' ', [], [])).rejects.toThrow('Banco de dados indisponível');
  });
});
