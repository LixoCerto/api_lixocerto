'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_usuarios_papeis', {
      lcr_upr_id_usuario_papel: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_upr_id_usuario: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_upr_id_papel: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_papeis', key: 'lcr_pap_id_papel' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_upr_data_atribuicao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      lcr_upr_data_expiracao: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addConstraint('lcr_usuarios_papeis', { fields: ['lcr_upr_id_usuario', 'lcr_upr_id_papel'], type: 'unique', name: 'uq_lcr_upr_usuario_papel' });
    await queryInterface.addIndex('lcr_usuarios_papeis', ['lcr_upr_id_usuario'], { name: 'ix_lcr_upr_usuario' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_usuarios_papeis');
  },
};
