'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_desafios', {
      lcr_des_id_desafio: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_des_nome_desafio: { type: Sequelize.STRING(160), allowNull: false, unique: true },
      lcr_des_descricao_desafio: { type: Sequelize.TEXT, allowNull: false },
      lcr_des_tipo_acao: { type: Sequelize.STRING(100), allowNull: false },
      lcr_des_meta_quantidade: { type: Sequelize.INTEGER, allowNull: false },
      lcr_des_quantidade_pontos: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lcr_des_status_desafio: { type: Sequelize.ENUM('rascunho', 'publicado', 'arquivado'), allowNull: false, defaultValue: 'rascunho' },
      lcr_des_data_inicio: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      lcr_des_data_fim: { type: Sequelize.DATE, allowNull: true },
      lcr_des_data_criacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      lcr_des_data_atualizacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('lcr_desafios', ['lcr_des_status_desafio', 'lcr_des_data_inicio'], { name: 'ix_lcr_des_status_inicio' });
    await queryInterface.addIndex('lcr_desafios', ['lcr_des_tipo_acao'], { name: 'ix_lcr_des_tipo_acao' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_desafios');
  },
};
