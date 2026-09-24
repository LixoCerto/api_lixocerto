'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_permissoes', {
      lcr_prm_id_permissao: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_prm_codigo_permissao: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      lcr_prm_nome_permissao: { type: Sequelize.STRING(120), allowNull: false },
      lcr_prm_descricao_permissao: { type: Sequelize.TEXT, allowNull: false },
      lcr_prm_status_permissao: { type: Sequelize.ENUM('ativo', 'inativo'), allowNull: false, defaultValue: 'ativo' },
      lcr_prm_data_criacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      lcr_prm_data_atualizacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_permissoes');
  },
};
