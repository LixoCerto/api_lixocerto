'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lcr_pontos_coleta', 'lcr_pco_categorias_aceitas', {
      type: Sequelize.ARRAY(Sequelize.STRING(80)),
      allowNull: false,
      defaultValue: [],
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('lcr_pontos_coleta', 'lcr_pco_categorias_aceitas');
  },
};
