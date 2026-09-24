'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_questoes', {
      lcr_que_id_questao: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_que_enunciado_questao: { type: Sequelize.TEXT, allowNull: false },
      lcr_que_explicacao_questao: { type: Sequelize.TEXT, allowNull: false },
      lcr_que_quantidade_pontos: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 50 },
      lcr_que_status_questao: { type: Sequelize.ENUM('rascunho', 'publicada', 'arquivada'), allowNull: false, defaultValue: 'rascunho' },
      lcr_que_data_criacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      lcr_que_data_atualizacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_questoes');
  },
};
