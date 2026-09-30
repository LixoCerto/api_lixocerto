import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const migration = require('../../banco/migracoes/034_checkin_evidencias_descartes.cjs') as {
  up: (queryInterface: unknown, Sequelize: Record<string, unknown>) => Promise<void>;
};

const Sequelize = {
  UUID: 'UUID',
  DECIMAL: (precision: number, scale: number) => `DECIMAL(${precision},${scale})`,
  FLOAT: 'FLOAT',
  STRING: (length: number) => `STRING(${length})`,
  INTEGER: 'INTEGER',
  DATE: 'DATE',
  literal: (value: string) => `LITERAL(${value})`,
};

describe('migration 034 — check-in e evidências de descarte', () => {
  it('cria check-in ligado a usuário/ponto e campos da foto com retenção', async () => {
    const queryInterface = {
      createTable: vi.fn().mockResolvedValue(undefined),
      addConstraint: vi.fn().mockResolvedValue(undefined),
      addIndex: vi.fn().mockResolvedValue(undefined),
      addColumn: vi.fn().mockResolvedValue(undefined),
      sequelize: { query: vi.fn().mockResolvedValue([]) },
    };

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledWith('lcr_checkins_descartes', expect.objectContaining({
      lcr_cde_id_usuario: expect.objectContaining({ references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' } }),
      lcr_cde_id_ponto_coleta: expect.objectContaining({ references: { model: 'lcr_pontos_coleta', key: 'lcr_pco_id_ponto_coleta' } }),
      lcr_cde_precisao_metros: expect.objectContaining({ allowNull: false }),
      lcr_cde_expira_em: expect.objectContaining({ allowNull: false }),
      lcr_cde_dados_expiram_em: expect.objectContaining({ allowNull: true }),
    }));
    for (const coluna of [
      'lcr_rde_id_checkin',
      'lcr_rde_chave_foto',
      'lcr_rde_hash_foto_sha256',
      'lcr_rde_tamanho_foto_bytes',
      'lcr_rde_foto_expira_em',
      'lcr_rde_foto_removida_em',
    ]) expect(queryInterface.addColumn).toHaveBeenCalledWith('lcr_registros_descartes', coluna, expect.any(Object));
    expect(queryInterface.sequelize.query).toHaveBeenCalledWith(expect.stringContaining("CHECK (lcr_cde_status IN ('ativo', 'finalizado'))"));
    expect(queryInterface.sequelize.query).toHaveBeenCalledWith(expect.stringContaining('ix_lcr_rde_foto_expira'));
  });
});
