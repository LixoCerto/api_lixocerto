import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const migration = require('../../banco/migracoes/031_adicionar_permissao_gerenciar_acessos.cjs') as {
  up: (queryInterface: unknown) => Promise<void>;
};

afterEach(() => {
  vi.restoreAllMocks();
});

function queryInterface(resultadosConsulta: unknown[][]) {
  const transaction = { commit: vi.fn(), rollback: vi.fn() };
  const query = vi.fn().mockImplementation(async () => resultadosConsulta.shift() ?? []);
  const bulkInsert = vi.fn().mockResolvedValue(undefined);
  return {
    interface: { sequelize: { transaction: vi.fn().mockResolvedValue(transaction), query }, bulkInsert },
    transaction,
    query,
    bulkInsert,
  };
}

describe('migration 031 — permissão de gestão de acessos', () => {
  it('roda em banco vazio antes do seed e deixa o seed associar a permissão ao administrador', async () => {
    const mock = queryInterface([[], [], []]);

    await expect(migration.up(mock.interface)).resolves.toBeUndefined();

    expect(mock.bulkInsert).toHaveBeenCalledTimes(1);
    expect(mock.bulkInsert.mock.calls[0][0]).toBe('lcr_permissoes');
    expect(mock.transaction.commit).toHaveBeenCalledOnce();
    expect(mock.transaction.rollback).not.toHaveBeenCalled();
  });

  it('atribui a permissão ao administrador existente sem duplicar relação', async () => {
    const mock = queryInterface([
      [{ lcr_prm_id_permissao: 'id-permissao-existente' }],
      [{ lcr_pap_id_papel: 'id-administrador' }],
      [],
    ]);

    await migration.up(mock.interface);

    expect(mock.bulkInsert).toHaveBeenCalledTimes(1);
    expect(mock.bulkInsert.mock.calls[0][0]).toBe('lcr_papeis_permissoes');
    expect(mock.bulkInsert.mock.calls[0][1][0]).toMatchObject({
      lcr_ppm_id_papel: 'id-administrador',
      lcr_ppm_id_permissao: 'id-permissao-existente',
    });
    expect(mock.transaction.commit).toHaveBeenCalledOnce();
  });
});
