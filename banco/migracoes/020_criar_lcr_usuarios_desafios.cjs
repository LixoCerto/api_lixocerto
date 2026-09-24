'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_usuarios_desafios', {
      lcr_ude_id_usuario_desafio: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_ude_id_usuario: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      lcr_ude_id_desafio: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_desafios', key: 'lcr_des_id_desafio' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      lcr_ude_quantidade_progresso: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lcr_ude_status_participacao: { type: Sequelize.ENUM('participando', 'concluido', 'abandonado'), allowNull: false, defaultValue: 'participando' },
      lcr_ude_data_inicio: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      lcr_ude_data_conclusao: { type: Sequelize.DATE, allowNull: true },
      lcr_ude_data_atualizacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('lcr_usuarios_desafios', { fields: ['lcr_ude_id_usuario', 'lcr_ude_id_desafio'], type: 'unique', name: 'uq_lcr_ude_usuario_desafio' });
    await queryInterface.addIndex('lcr_usuarios_desafios', ['lcr_ude_id_usuario', 'lcr_ude_status_participacao'], { name: 'ix_lcr_ude_usuario_status' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_usuarios_desafios');
  },
};
