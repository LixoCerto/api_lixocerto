'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lcr_usuarios', 'lcr_usr_email_verificado_em', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('lcr_usuarios', 'lcr_usr_email_verificado_em');
  },
};