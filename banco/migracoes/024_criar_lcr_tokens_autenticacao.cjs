'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_tokens_autenticacao', {
      lcr_tka_id_token: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_tka_id_usuario: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      lcr_tka_tipo_token: { type: Sequelize.STRING(30), allowNull: false },
      lcr_tka_hash_token: { type: Sequelize.TEXT, allowNull: false },
      lcr_tka_data_expiracao: { type: Sequelize.DATE, allowNull: false },
      lcr_tka_data_consumo: { type: Sequelize.DATE, allowNull: true },
      lcr_tka_quantidade_tentativas: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lcr_tka_endereco_ip: { type: Sequelize.INET, allowNull: true },
      lcr_tka_agente_usuario: { type: Sequelize.TEXT, allowNull: true },
      lcr_tka_data_criacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('lcr_tokens_autenticacao', ['lcr_tka_hash_token'], { name: 'uq_lcr_tka_hash_token', unique: true });
    await queryInterface.addIndex('lcr_tokens_autenticacao', ['lcr_tka_id_usuario', 'lcr_tka_tipo_token'], { name: 'ix_lcr_tka_usuario_tipo' });
    await queryInterface.addConstraint('lcr_tokens_autenticacao', {
      fields: ['lcr_tka_tipo_token'],
      type: 'check',
      name: 'ck_lcr_tka_tipo_token',
      where: { lcr_tka_tipo_token: ['verificacao_email', 'redefinicao_senha'] },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_tokens_autenticacao');
  },
};