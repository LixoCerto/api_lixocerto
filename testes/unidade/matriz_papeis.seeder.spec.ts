import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const seeder = require('../../banco/dados_iniciais/001_inserir_papeis_permissoes.cjs') as {
  up: (queryInterface: unknown) => Promise<void>;
};

const esperadas: Record<string, string[]> = {
  usuario: [
    'materiais:ler',
    'pontos_coleta:ler',
    'questionarios:responder',
    'gamificacao:ler',
    'gamificacao:participar',
    'avaliacao_usabilidade:enviar',
  ],
  pesquisador: [
    'materiais:ler',
    'pontos_coleta:ler',
    'gamificacao:ler',
    'avaliacao_usabilidade:consultar_agregados',
  ],
  revisor: [
    'materiais:ler',
    'materiais:escrever',
    'materiais:aprovar',
    'pontos_coleta:ler',
    'pontos_coleta:escrever',
    'pontos_coleta:aprovar',
    'questionarios:responder',
    'questionarios:administrar',
    'gamificacao:ler',
    'gamificacao:administrar',
  ],
};

describe('seed geral — matriz de papéis-base', () => {
  it('associa somente as permissões previstas a usuário, pesquisador e revisor; administrador recebe o catálogo completo', async () => {
    const insercoes: Array<{ tabela: string; linhas: Record<string, string>[] }> = [];
    const query = vi.fn().mockResolvedValue([]);
    const bulkInsert = vi.fn(async (tabela: string, linhas: Record<string, string>[]) => {
      insercoes.push({ tabela, linhas });
    });
    await seeder.up({ sequelize: { query }, bulkInsert });

    const papeis = insercoes.find(insercao => insercao.tabela === 'lcr_papeis')!.linhas;
    const permissoes = insercoes.find(insercao => insercao.tabela === 'lcr_permissoes')!.linhas;
    const relacoes = insercoes.find(insercao => insercao.tabela === 'lcr_papeis_permissoes')!.linhas;
    const papelPorId = new Map(papeis.map(papel => [papel.lcr_pap_id_papel, papel.lcr_pap_nome_papel]));
    const permissaoPorId = new Map(permissoes.map(permissao => [permissao.lcr_prm_id_permissao, permissao.lcr_prm_codigo_permissao]));
    const efetivas: Record<string, string[]> = {};
    for (const relacao of relacoes) {
      const papel = papelPorId.get(relacao.lcr_ppm_id_papel)!;
      const permissao = permissaoPorId.get(relacao.lcr_ppm_id_permissao)!;
      (efetivas[papel] ??= []).push(permissao);
    }
    for (const papel of ['usuario', 'pesquisador', 'revisor']) {
      expect([...efetivas[papel]!].sort()).toEqual([...esperadas[papel]!].sort());
    }
    expect(new Set(efetivas.administrador)).toEqual(new Set(permissoes.map(permissao => permissao.lcr_prm_codigo_permissao)));
    expect(permissoes.map(permissao => permissao.lcr_prm_codigo_permissao)).toContain('gamificacao:participar');
    expect(query).toHaveBeenCalledTimes(3);
  });
});
