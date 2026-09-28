'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lcr_pontos_coleta', 'lcr_pco_cep_ponto_coleta', {
      type: Sequelize.STRING(8),
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('lcr_pontos_coleta', 'lcr_pco_cep_ponto_coleta');
  },
};
