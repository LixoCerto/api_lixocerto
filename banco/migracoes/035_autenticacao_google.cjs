'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lcr_usuarios', 'lcr_usr_google_subject', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addIndex('lcr_usuarios', ['lcr_usr_google_subject'], {
      name: 'uq_lcr_usr_google_subject',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('lcr_usuarios', 'uq_lcr_usr_google_subject');
    await queryInterface.removeColumn('lcr_usuarios', 'lcr_usr_google_subject');
  },
};
