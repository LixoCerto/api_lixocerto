'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_papeis', {
      lcr_pap_id_papel: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_pap_nome_papel: { type: Sequelize.STRING(60), allowNull: false, unique: true },
      lcr_pap_descricao_papel: { type: Sequelize.TEXT, allowNull: false },
      lcr_pap_status_papel: { type: Sequelize.ENUM('ativo', 'inativo'), allowNull: false, defaultValue: 'ativo' },
      lcr_pap_data_criacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      lcr_pap_data_atualizacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_papeis');
  },
};
