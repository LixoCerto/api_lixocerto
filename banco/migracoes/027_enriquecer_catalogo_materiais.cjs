'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const colunas = [
      ['lcr_mat_codigo_catalogo', { type: Sequelize.STRING(100), allowNull: true }],
      ['lcr_mat_classificacao', { type: Sequelize.TEXT, allowNull: false, defaultValue: '' }],
      ['lcr_mat_sinonimos', { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") }],
      ['lcr_mat_preparacao', { type: Sequelize.TEXT, allowNull: false, defaultValue: '' }],
      ['lcr_mat_cuidados', { type: Sequelize.TEXT, allowNull: false, defaultValue: '' }],
      ['lcr_mat_categorias_pontos', { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") }],
      ['lcr_mat_rotas_referencia', { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") }],
      ['lcr_mat_abrangencia', { type: Sequelize.STRING(60), allowNull: false, defaultValue: 'confirmar_localmente' }],
      ['lcr_mat_escopo_detalhado', { type: Sequelize.TEXT, allowNull: false, defaultValue: '' }],
      ['lcr_mat_fontes_referencia', { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") }],
      ['lcr_mat_data_verificacao', { type: Sequelize.DATEONLY, allowNull: true }],
      ['lcr_mat_observacao_revisao', { type: Sequelize.TEXT, allowNull: true }],
      ['lcr_mat_id_usuario_criador', { type: Sequelize.UUID, allowNull: true, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }],
      ['lcr_mat_id_usuario_editor', { type: Sequelize.UUID, allowNull: true, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }],
      ['lcr_mat_id_usuario_revisor', { type: Sequelize.UUID, allowNull: true, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }],
      ['lcr_mat_data_publicacao', { type: Sequelize.DATE, allowNull: true }],
    ];

    for (const [nome, definicao] of colunas) await queryInterface.addColumn('lcr_materiais', nome, definicao);
    await queryInterface.addIndex('lcr_materiais', ['lcr_mat_codigo_catalogo'], { name: 'ux_lcr_mat_codigo_catalogo', unique: true });
    await queryInterface.addIndex('lcr_materiais', ['lcr_mat_abrangencia'], { name: 'ix_lcr_mat_abrangencia' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('lcr_materiais', 'ix_lcr_mat_abrangencia');
    await queryInterface.removeIndex('lcr_materiais', 'ux_lcr_mat_codigo_catalogo');
    for (const coluna of [
      'lcr_mat_data_publicacao',
      'lcr_mat_id_usuario_revisor',
      'lcr_mat_id_usuario_editor',
      'lcr_mat_id_usuario_criador',
      'lcr_mat_observacao_revisao',
      'lcr_mat_data_verificacao',
      'lcr_mat_fontes_referencia',
      'lcr_mat_escopo_detalhado',
      'lcr_mat_abrangencia',
      'lcr_mat_rotas_referencia',
      'lcr_mat_categorias_pontos',
      'lcr_mat_cuidados',
      'lcr_mat_preparacao',
      'lcr_mat_sinonimos',
      'lcr_mat_classificacao',
      'lcr_mat_codigo_catalogo',
    ]) await queryInterface.removeColumn('lcr_materiais', coluna);
  },
};
