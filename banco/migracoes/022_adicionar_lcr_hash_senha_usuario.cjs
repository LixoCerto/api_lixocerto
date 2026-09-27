'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lcr_usuarios', 'lcr_usr_hash_senha', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('lcr_usuarios', 'lcr_usr_hash_senha');
  },
};
