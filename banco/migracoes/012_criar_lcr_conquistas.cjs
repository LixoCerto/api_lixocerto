'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_conquistas', {
      lcr_con_id_conquista: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_con_nome_conquista: { type: Sequelize.STRING(140), allowNull: false, unique: true },
      lcr_con_descricao_conquista: { type: Sequelize.TEXT, allowNull: false },
      lcr_con_quantidade_pontos: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lcr_con_icone_conquista: { type: Sequelize.STRING(80), allowNull: true },
      lcr_con_status_conquista: { type: Sequelize.ENUM('ativa', 'inativa'), allowNull: false, defaultValue: 'ativa' },
      lcr_con_data_criacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_conquistas');
  },
};
