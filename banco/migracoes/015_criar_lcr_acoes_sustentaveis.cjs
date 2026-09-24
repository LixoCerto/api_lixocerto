'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_acoes_sustentaveis', {
      lcr_ast_id_acao_sustentavel: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_ast_id_usuario: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_ast_tipo_acao: { type: Sequelize.STRING(100), allowNull: false },
      lcr_ast_descricao_acao: { type: Sequelize.TEXT, allowNull: true },
      lcr_ast_quantidade_pontos: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lcr_ast_data_registro: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('lcr_acoes_sustentaveis', ['lcr_ast_id_usuario', 'lcr_ast_data_registro'], { name: 'ix_lcr_ast_usuario_data' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_acoes_sustentaveis');
  },
};
