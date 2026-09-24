'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_respostas_sus', {
      lcr_rsu_id_resposta_sus: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_rsu_id_sessao_avaliacao: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_sessoes_avaliacao', key: 'lcr_sea_id_sessao_avaliacao' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      lcr_rsu_numero_item: { type: Sequelize.INTEGER, allowNull: false },
      lcr_rsu_nota_item: { type: Sequelize.INTEGER, allowNull: false },
      lcr_rsu_data_criacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('lcr_respostas_sus', { fields: ['lcr_rsu_id_sessao_avaliacao', 'lcr_rsu_numero_item'], type: 'unique', name: 'uq_lcr_rsu_sessao_item' });
    await queryInterface.addConstraint('lcr_respostas_sus', { fields: ['lcr_rsu_nota_item'], type: 'check', where: { lcr_rsu_nota_item: { [require('sequelize').Op.between]: [1, 5] } }, name: 'ck_lcr_rsu_nota_valida' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_respostas_sus');
  },
};
