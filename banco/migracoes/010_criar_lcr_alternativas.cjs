'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_alternativas', {
      lcr_alt_id_alternativa: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_alt_id_questao: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_questoes', key: 'lcr_que_id_questao' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      lcr_alt_texto_alternativa: { type: Sequelize.TEXT, allowNull: false },
      lcr_alt_indica_correta: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      lcr_alt_ordem_exibicao: { type: Sequelize.INTEGER, allowNull: false },
    });
    await queryInterface.addIndex('lcr_alternativas', ['lcr_alt_id_questao'], { name: 'ix_lcr_alt_questao' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_alternativas');
  },
};
