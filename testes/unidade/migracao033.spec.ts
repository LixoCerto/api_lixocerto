import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const migration = require('../../banco/migracoes/033_engajamento_quizzes_selos_desafios.cjs') as {
  up: (queryInterface: unknown, Sequelize: Record<string, unknown>) => Promise<void>;
};

const Sequelize = {
  UUID: 'UUID',
  STRING: (length: number) => `STRING(${length})`,
  INTEGER: 'INTEGER',
  DATE: 'DATE',
  BOOLEAN: 'BOOLEAN',
  JSONB: 'JSONB',
  literal: (value: string) => `LITERAL(${value})`,
};

describe('migration 033 — gamificação e desafios recorrentes', () => {
  it('cria atribuições únicas, ledger, selos, descartes e ciclos de desafio', async () => {
    const queryInterface = {
      addColumn: vi.fn().mockResolvedValue(undefined),
      createTable: vi.fn().mockResolvedValue(undefined),
      addConstraint: vi.fn().mockResolvedValue(undefined),
      addIndex: vi.fn().mockResolvedValue(undefined),
      removeConstraint: vi.fn().mockResolvedValue(undefined),
      sequelize: { query: vi.fn().mockResolvedValue([]) },
    };

    await migration.up(queryInterface, Sequelize);

    const tabelas = queryInterface.createTable.mock.calls.map(chamada => chamada[0]);
    expect(tabelas).toEqual([
      'lcr_quiz_atribuicoes',
      'lcr_eventos_pontos',
      'lcr_selos',
      'lcr_usuarios_selos',
      'lcr_registros_descartes',
    ]);
    expect(queryInterface.addColumn).toHaveBeenCalledWith('lcr_questoes', 'lcr_que_tema_questao', expect.objectContaining({ allowNull: false }));
    expect(queryInterface.addColumn).toHaveBeenCalledWith('lcr_desafios', 'lcr_des_periodicidade', expect.objectContaining({ defaultValue: 'unica' }));
    expect(queryInterface.addConstraint).toHaveBeenCalledWith('lcr_quiz_atribuicoes', expect.objectContaining({ name: 'uq_lcr_qat_usuario_questao' }));
    expect(queryInterface.addConstraint).toHaveBeenCalledWith('lcr_eventos_pontos', expect.objectContaining({ name: 'uq_lcr_evp_origem_usuario' }));
    expect(queryInterface.addConstraint).toHaveBeenCalledWith('lcr_usuarios_desafios', expect.objectContaining({ name: 'uq_lcr_ude_usuario_desafio_periodo' }));
    expect(queryInterface.sequelize.query).toHaveBeenCalledWith(expect.stringContaining('Broto consciente'));
  });
});
