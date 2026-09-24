'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_pontos_coleta', {
      lcr_pco_id_ponto_coleta: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_pco_nome_ponto_coleta: { type: Sequelize.STRING(180), allowNull: false },
      lcr_pco_endereco_ponto_coleta: { type: Sequelize.TEXT, allowNull: false },
      lcr_pco_cidade_ponto_coleta: { type: Sequelize.STRING(100), allowNull: false },
      lcr_pco_estado_ponto_coleta: { type: Sequelize.CHAR(2), allowNull: false },
      lcr_pco_latitude_ponto_coleta: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      lcr_pco_longitude_ponto_coleta: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      lcr_pco_status_verificacao: { type: Sequelize.ENUM('pendente', 'verificado', 'rejeitado', 'expirado'), allowNull: false, defaultValue: 'pendente' },
      lcr_pco_origem_informacao: { type: Sequelize.TEXT, allowNull: true },
      lcr_pco_data_verificacao: { type: Sequelize.DATE, allowNull: true },
      lcr_pco_id_usuario_cadastrador: { type: Sequelize.UUID, allowNull: true, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      lcr_pco_data_criacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      lcr_pco_data_atualizacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('lcr_pontos_coleta', ['lcr_pco_cidade_ponto_coleta'], { name: 'ix_lcr_pco_cidade' });
    await queryInterface.addIndex('lcr_pontos_coleta', ['lcr_pco_status_verificacao'], { name: 'ix_lcr_pco_status_verificacao' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_pontos_coleta');
  },
};
