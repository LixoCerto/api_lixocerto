'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_materiais', {
      lcr_mat_id_material: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_mat_nome_material: { type: Sequelize.STRING(160), allowNull: false },
      lcr_mat_categoria_material: { type: Sequelize.STRING(80), allowNull: false },
      lcr_mat_instrucao_descarte: { type: Sequelize.TEXT, allowNull: false },
      lcr_mat_observacao_impacto: { type: Sequelize.TEXT, allowNull: false },
      lcr_mat_icone_material: { type: Sequelize.STRING(80), allowNull: true },
      lcr_mat_versao_conteudo: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      lcr_mat_status_material: { type: Sequelize.ENUM('rascunho', 'publicado', 'arquivado'), allowNull: false, defaultValue: 'rascunho' },
      lcr_mat_data_criacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      lcr_mat_data_atualizacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('lcr_materiais', ['lcr_mat_categoria_material'], { name: 'ix_lcr_mat_categoria' });
    await queryInterface.addIndex('lcr_materiais', ['lcr_mat_status_material'], { name: 'ix_lcr_mat_status' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_materiais');
  },
};
