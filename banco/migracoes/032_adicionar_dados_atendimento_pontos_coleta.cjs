'use strict';

const COLUNAS = [
  'lcr_pco_horario_funcionamento',
  'lcr_pco_telefone_contato',
  'lcr_pco_url_informacoes',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lcr_pontos_coleta', COLUNAS[0], {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn('lcr_pontos_coleta', COLUNAS[1], {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
    await queryInterface.addColumn('lcr_pontos_coleta', COLUNAS[2], {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('lcr_pontos_coleta', COLUNAS[2]);
    await queryInterface.removeColumn('lcr_pontos_coleta', COLUNAS[1]);
    await queryInterface.removeColumn('lcr_pontos_coleta', COLUNAS[0]);
  },
};
