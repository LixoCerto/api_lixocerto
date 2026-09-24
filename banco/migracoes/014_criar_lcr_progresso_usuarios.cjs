'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_progresso_usuarios', {
      lcr_prg_id_progresso_usuario: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_prg_id_usuario: { type: Sequelize.UUID, allowNull: false, unique: true, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      lcr_prg_quantidade_pontos: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lcr_prg_nivel_gamificacao: { type: Sequelize.STRING(80), allowNull: false, defaultValue: 'iniciante' },
      lcr_prg_sequencia_dias: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lcr_prg_data_ultima_atividade: { type: Sequelize.DATE, allowNull: true },
      lcr_prg_data_atualizacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_progresso_usuarios');
  },
};
