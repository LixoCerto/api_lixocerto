'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    await queryInterface.createTable('lcr_usuarios', {
      lcr_usr_id_usuario: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_usr_id_externo: { type: Sequelize.STRING(180), allowNull: false, unique: true },
      lcr_usr_nome: { type: Sequelize.STRING(180), allowNull: false },
      lcr_usr_email: { type: Sequelize.STRING(320), allowNull: false, unique: true },
      lcr_usr_status_usuario: { type: Sequelize.ENUM('ativo', 'bloqueado', 'anonimizado'), allowNull: false, defaultValue: 'ativo' },
      lcr_usr_data_criacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      lcr_usr_data_atualizacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      lcr_usr_data_ultimo_acesso: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('lcr_usuarios', ['lcr_usr_email'], { name: 'uq_lcr_usr_email', unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_usuarios');
  },
};
