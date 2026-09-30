import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const seeder = require('../../banco/seeds_homologacao/002_preparar_leva_inicial_guia.cjs') as {
  up: (queryInterface: unknown) => Promise<void>;
  down: () => Promise<void>;
  CODIGOS_LEVA: string[];
  MARCADOR_CURADORIA: string;
  DATA_CURADORIA: string;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function prepararAmbiente() {
  vi.stubEnv('AMBIENTE_EXECUCAO', 'desenvolvimento');
  vi.stubEnv('LCR_PREPARAR_LEVA_GUIA_INICIAL', 'true');
}

function registrosRascunhoOriginal() {
  return seeder.CODIGOS_LEVA.map(codigo => ({
    lcr_mat_codigo_catalogo: codigo,
    lcr_mat_status_material: 'rascunho',
    lcr_mat_versao_conteudo: 1,
    lcr_mat_observacao_revisao: 'RASCUNHO DE PESQUISA. Revisão humana obrigatória.',
    lcr_mat_data_verificacao: null,
    lcr_mat_id_usuario_revisor: null,
    lcr_mat_data_publicacao: null,
  }));
}

function queryInterfaceCom(registros: unknown[]) {
  const query = vi.fn(async (sql: string, options?: unknown) => {
    void options;
    if (sql.includes('SELECT lcr_mat_codigo_catalogo')) return registros;
    if (sql.includes('UPDATE lcr_materiais')) return [[{ lcr_mat_id_material: 'material-id' }], {}];
    throw new Error('Consulta inesperada no teste do seeder.');
  });
  const sequelize = {
    query,
    transaction: vi.fn(async (callback: (transaction: object) => Promise<void>) => callback({ id: 'tx-teste' })),
  };
  return { queryInterface: { sequelize }, query, sequelize };
}

describe('seeder do lote inicial do Guia', () => {
  it('exige ambiente de desenvolvimento e opt-in explícito antes de acessar o banco', async () => {
    vi.stubEnv('AMBIENTE_EXECUCAO', 'producao');
    vi.stubEnv('LCR_PREPARAR_LEVA_GUIA_INICIAL', 'true');
    const { queryInterface, query } = queryInterfaceCom(registrosRascunhoOriginal());

    await expect(seeder.up(queryInterface)).rejects.toThrow('só pode rodar com AMBIENTE_EXECUCAO=desenvolvimento');
    expect(query).not.toHaveBeenCalled();
  });

  it('atualiza somente os cinco registros de rascunho original sem publicá-los', async () => {
    prepararAmbiente();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { queryInterface, query, sequelize } = queryInterfaceCom(registrosRascunhoOriginal());

    await seeder.up(queryInterface);

    expect(sequelize.transaction).toHaveBeenCalledOnce();
    const atualizacoes = query.mock.calls.filter(([sql]) => sql.includes('UPDATE lcr_materiais'));
    expect(atualizacoes).toHaveLength(5);
    for (const [sql, options] of atualizacoes) {
      expect(sql).toContain("lcr_mat_status_material = 'rascunho'");
      expect(sql).toContain('lcr_mat_versao_conteudo = 1');
      expect(sql).not.toContain("lcr_mat_status_material = 'publicado'");
      expect(options).toHaveProperty('transaction');
    }
  });

  it('é idempotente quando o lote já foi preparado e segue em rascunho', async () => {
    prepararAmbiente();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const registros = registrosRascunhoOriginal().map(registro => ({
      ...registro,
      lcr_mat_versao_conteudo: 2,
      lcr_mat_observacao_revisao: seeder.MARCADOR_CURADORIA,
      lcr_mat_data_verificacao: seeder.DATA_CURADORIA,
    }));
    const { queryInterface, query } = queryInterfaceCom(registros);

    await seeder.up(queryInterface);

    expect(query.mock.calls.filter(([sql]) => sql.includes('UPDATE lcr_materiais'))).toHaveLength(0);
  });

  it('não altera nada se algum registro foi publicado ou editado fora do estado esperado', async () => {
    prepararAmbiente();
    const registros = registrosRascunhoOriginal().map((registro, indice) =>
      indice === 0 ? { ...registro, lcr_mat_status_material: 'publicado' } : registro,
    );
    const { queryInterface, query } = queryInterfaceCom(registros);

    await expect(seeder.up(queryInterface)).rejects.toThrow('Nenhuma alteração aplicada');
    expect(query.mock.calls.filter(([sql]) => sql.includes('UPDATE lcr_materiais'))).toHaveLength(0);
  });

  it('falha sem atualizar se algum dos cinco códigos não existe no banco', async () => {
    prepararAmbiente();
    const { queryInterface, query } = queryInterfaceCom(registrosRascunhoOriginal().slice(1));

    await expect(seeder.up(queryInterface)).rejects.toThrow('execute primeiro o seed do catálogo');
    expect(query.mock.calls.filter(([sql]) => sql.includes('UPDATE lcr_materiais'))).toHaveLength(0);
  });

  it('recusa rollback destrutivo dos textos curados', async () => {
    await expect(seeder.down()).rejects.toThrow('não é reversível');
  });
});
