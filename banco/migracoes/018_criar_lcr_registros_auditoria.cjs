'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lcr_registros_auditoria', {
      lcr_aud_id_registro_auditoria: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_aud_id_usuario: { type: Sequelize.UUID, allowNull: true, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      lcr_aud_tipo_evento: { type: Sequelize.STRING(100), allowNull: false },
      lcr_aud_recurso_evento: { type: Sequelize.STRING(120), allowNull: true },
      lcr_aud_id_recurso: { type: Sequelize.UUID, allowNull: true },
      lcr_aud_endereco_ip: { type: Sequelize.INET, allowNull: true },
      lcr_aud_id_correlacao: { type: Sequelize.STRING(120), allowNull: false },
      lcr_aud_detalhes_evento: { type: Sequelize.JSONB, allowNull: true },
      lcr_aud_data_criacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('lcr_registros_auditoria', ['lcr_aud_data_criacao'], { name: 'ix_lcr_aud_data_criacao' });
    await queryInterface.addIndex('lcr_registros_auditoria', ['lcr_aud_tipo_evento'], { name: 'ix_lcr_aud_tipo_evento' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lcr_registros_auditoria');
  },
};
