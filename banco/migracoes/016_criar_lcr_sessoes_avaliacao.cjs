'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_sessoes_avaliacao', {
      lcr_sea_id_sessao_avaliacao: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_sea_codigo_participante_hash: { type: Sequelize.TEXT, allowNull: false },
      lcr_sea_indica_consentimento: { type: Sequelize.BOOLEAN, allowNull: false },
      lcr_sea_versao_instrumento: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'SUS-1.0' },
      lcr_sea_data_inicio: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      lcr_sea_data_conclusao: { type: Sequelize.DATE, allowNull: true },
      lcr_sea_data_criacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('lcr_sessoes_avaliacao', ['lcr_sea_codigo_participante_hash'], { name: 'ix_lcr_sea_participante' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_sessoes_avaliacao');
  },
};
