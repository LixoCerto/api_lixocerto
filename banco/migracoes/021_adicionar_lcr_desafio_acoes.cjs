'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lcr_acoes_sustentaveis', 'lcr_ast_id_desafio', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'lcr_desafios', key: 'lcr_des_id_desafio' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('lcr_acoes_sustentaveis', ['lcr_ast_id_desafio', 'lcr_ast_data_registro'], { name: 'ix_lcr_ast_desafio_data' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('lcr_acoes_sustentaveis', 'lcr_ast_id_desafio');
  },
};
