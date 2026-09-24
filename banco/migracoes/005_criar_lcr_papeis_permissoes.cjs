'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_papeis_permissoes', {
      lcr_ppm_id_papel_permissao: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_ppm_id_papel: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_papeis', key: 'lcr_pap_id_papel' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_ppm_id_permissao: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_permissoes', key: 'lcr_prm_id_permissao' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_ppm_data_atribuicao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('lcr_papeis_permissoes', { fields: ['lcr_ppm_id_papel', 'lcr_ppm_id_permissao'], type: 'unique', name: 'uq_lcr_ppm_papel_permissao' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_papeis_permissoes');
  },
};
