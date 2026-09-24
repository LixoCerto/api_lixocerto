'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_sessoes', {
      lcr_ses_id_sessao: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_ses_id_usuario: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      lcr_ses_hash_token: { type: Sequelize.TEXT, allowNull: false },
      lcr_ses_hash_token_atualizacao: { type: Sequelize.TEXT, allowNull: false },
      lcr_ses_endereco_ip: { type: Sequelize.INET, allowNull: true },
      lcr_ses_agente_usuario: { type: Sequelize.TEXT, allowNull: true },
      lcr_ses_data_expiracao: { type: Sequelize.DATE, allowNull: false },
      lcr_ses_data_revogacao: { type: Sequelize.DATE, allowNull: true },
      lcr_ses_data_criacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('lcr_sessoes', ['lcr_ses_id_usuario'], { name: 'ix_lcr_ses_usuario' });
    await queryInterface.addIndex('lcr_sessoes', ['lcr_ses_hash_token'], { name: 'uq_lcr_ses_hash_token', unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_sessoes');
  },
};
