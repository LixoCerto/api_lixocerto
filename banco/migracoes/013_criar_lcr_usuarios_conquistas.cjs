'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_usuarios_conquistas', {
      lcr_uco_id_usuario_conquista: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_uco_id_usuario: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      lcr_uco_id_conquista: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_conquistas', key: 'lcr_con_id_conquista' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_uco_data_conquista: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('lcr_usuarios_conquistas', { fields: ['lcr_uco_id_usuario', 'lcr_uco_id_conquista'], type: 'unique', name: 'uq_lcr_uco_usuario_conquista' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_usuarios_conquistas');
  },
};
