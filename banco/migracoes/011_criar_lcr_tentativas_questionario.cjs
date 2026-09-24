'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_tentativas_questionario', {
      lcr_tqu_id_tentativa_questionario: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_tqu_id_usuario: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_tqu_id_questao: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_questoes', key: 'lcr_que_id_questao' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_tqu_id_alternativa: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_alternativas', key: 'lcr_alt_id_alternativa' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_tqu_indica_correta: { type: Sequelize.BOOLEAN, allowNull: false },
      lcr_tqu_quantidade_pontos: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lcr_tqu_data_tentativa: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('lcr_tentativas_questionario', ['lcr_tqu_id_usuario', 'lcr_tqu_data_tentativa'], { name: 'ix_lcr_tqu_usuario_data' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_tentativas_questionario');
  },
};
