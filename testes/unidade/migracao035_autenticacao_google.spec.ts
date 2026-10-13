import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const migration = require('../../banco/migracoes/035_autenticacao_google.cjs') as {
  up: (queryInterface: unknown, Sequelize: Record<string, unknown>) => Promise<void>;
  down: (queryInterface: unknown) => Promise<void>;
};

const Sequelize = { STRING: (length: number) => `STRING(${length})` };

describe('migration 035 — autenticacao Google', () => {
  it('adiciona uma coluna nullable e subject com índice único', async () => {
    const queryInterface = {
      addColumn: vi.fn().mockResolvedValue(undefined),
      addIndex: vi.fn().mockResolvedValue(undefined),
    };

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addColumn).toHaveBeenCalledWith('lcr_usuarios', 'lcr_usr_google_subject', {
      type: 'STRING(255)',
      allowNull: true,
    });
    expect(queryInterface.addIndex).toHaveBeenCalledWith('lcr_usuarios', ['lcr_usr_google_subject'], {
      name: 'uq_lcr_usr_google_subject',
      unique: true,
    });
  });

  it('remove primeiro o índice e depois a coluna no rollback', async () => {
    const queryInterface = {
      removeIndex: vi.fn().mockResolvedValue(undefined),
      removeColumn: vi.fn().mockResolvedValue(undefined),
    };

    await migration.down(queryInterface);

    expect(queryInterface.removeIndex).toHaveBeenCalledWith('lcr_usuarios', 'uq_lcr_usr_google_subject');
    expect(queryInterface.removeColumn).toHaveBeenCalledWith('lcr_usuarios', 'lcr_usr_google_subject');
  });
});
