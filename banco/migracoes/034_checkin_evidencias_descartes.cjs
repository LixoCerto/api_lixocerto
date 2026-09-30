'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_checkins_descartes', {
      lcr_cde_id_checkin: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_cde_id_usuario: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_cde_id_ponto_coleta: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_pontos_coleta', key: 'lcr_pco_id_ponto_coleta' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_cde_latitude_usuario: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      lcr_cde_longitude_usuario: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      lcr_cde_precisao_metros: { type: Sequelize.FLOAT, allowNull: false },
      lcr_cde_distancia_metros: { type: Sequelize.FLOAT, allowNull: false },
      lcr_cde_status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ativo' },
      lcr_cde_data_checkin: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      lcr_cde_expira_em: { type: Sequelize.DATE, allowNull: false },
      lcr_cde_data_finalizacao: { type: Sequelize.DATE, allowNull: true },
      lcr_cde_dados_expiram_em: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.sequelize.query(`
      ALTER TABLE lcr_checkins_descartes
      ADD CONSTRAINT ck_lcr_cde_status
      CHECK (lcr_cde_status IN ('ativo', 'finalizado'))
    `);
    await queryInterface.addIndex('lcr_checkins_descartes', ['lcr_cde_id_usuario', 'lcr_cde_status', 'lcr_cde_expira_em'], { name: 'ix_lcr_cde_usuario_status_expira' });
    await queryInterface.addIndex('lcr_checkins_descartes', ['lcr_cde_dados_expiram_em'], { name: 'ix_lcr_cde_dados_expiram' });

    await queryInterface.addColumn('lcr_registros_descartes', 'lcr_rde_id_checkin', {
      type: Sequelize.UUID, allowNull: true,
      references: { model: 'lcr_checkins_descartes', key: 'lcr_cde_id_checkin' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT',
    });
    await queryInterface.addColumn('lcr_registros_descartes', 'lcr_rde_chave_foto', { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addColumn('lcr_registros_descartes', 'lcr_rde_hash_foto_sha256', { type: Sequelize.STRING(64), allowNull: true });
    await queryInterface.addColumn('lcr_registros_descartes', 'lcr_rde_tamanho_foto_bytes', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('lcr_registros_descartes', 'lcr_rde_foto_expira_em', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('lcr_registros_descartes', 'lcr_rde_foto_removida_em', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.sequelize.query(`
      CREATE INDEX ix_lcr_rde_foto_expira
      ON lcr_registros_descartes (lcr_rde_foto_expira_em)
      WHERE lcr_rde_chave_foto IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS ix_lcr_rde_foto_expira');
    await queryInterface.removeColumn('lcr_registros_descartes', 'lcr_rde_foto_removida_em');
    await queryInterface.removeColumn('lcr_registros_descartes', 'lcr_rde_foto_expira_em');
    await queryInterface.removeColumn('lcr_registros_descartes', 'lcr_rde_tamanho_foto_bytes');
    await queryInterface.removeColumn('lcr_registros_descartes', 'lcr_rde_hash_foto_sha256');
    await queryInterface.removeColumn('lcr_registros_descartes', 'lcr_rde_chave_foto');
    await queryInterface.removeColumn('lcr_registros_descartes', 'lcr_rde_id_checkin');
    await queryInterface.dropTable('lcr_checkins_descartes');
  },
};
