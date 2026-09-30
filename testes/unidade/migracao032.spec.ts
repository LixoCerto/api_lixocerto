import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const migration = require('../../banco/migracoes/032_adicionar_dados_atendimento_pontos_coleta.cjs') as {
  up: (queryInterface: unknown, Sequelize: { STRING: (length: number) => unknown; TEXT: unknown }) => Promise<void>;
  down: (queryInterface: unknown) => Promise<void>;
};

describe('migration 032 — dados de atendimento dos pontos de coleta', () => {
  it('adiciona campos opcionais sem reescrever registros', async () => {
    const queryInterface = { addColumn: vi.fn().mockResolvedValue(undefined) };
    await migration.up(queryInterface, { STRING: (length: number) => `STRING(${length})`, TEXT: 'TEXT' });

    expect(queryInterface.addColumn).toHaveBeenCalledTimes(3);
    expect(queryInterface.addColumn).toHaveBeenNthCalledWith(1, 'lcr_pontos_coleta', 'lcr_pco_horario_funcionamento', { type: 'STRING(500)', allowNull: true });
    expect(queryInterface.addColumn).toHaveBeenNthCalledWith(2, 'lcr_pontos_coleta', 'lcr_pco_telefone_contato', { type: 'STRING(40)', allowNull: true });
    expect(queryInterface.addColumn).toHaveBeenNthCalledWith(3, 'lcr_pontos_coleta', 'lcr_pco_url_informacoes', { type: 'TEXT', allowNull: true });
  });

  it('remove apenas as colunas adicionadas, em ordem inversa', async () => {
    const queryInterface = { removeColumn: vi.fn().mockResolvedValue(undefined) };
    await migration.down(queryInterface);

    expect(queryInterface.removeColumn).toHaveBeenNthCalledWith(1, 'lcr_pontos_coleta', 'lcr_pco_url_informacoes');
    expect(queryInterface.removeColumn).toHaveBeenNthCalledWith(2, 'lcr_pontos_coleta', 'lcr_pco_telefone_contato');
    expect(queryInterface.removeColumn).toHaveBeenNthCalledWith(3, 'lcr_pontos_coleta', 'lcr_pco_horario_funcionamento');
  });
});
