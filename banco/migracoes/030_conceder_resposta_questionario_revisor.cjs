'use strict';

const { randomUUID } = require('node:crypto');
const { QueryTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const permissoes = await queryInterface.sequelize.query(
      "SELECT lcr_prm_id_permissao FROM lcr_permissoes WHERE lcr_prm_codigo_permissao = 'questionarios:responder'",
      { type: QueryTypes.SELECT },
    );
    const revisores = await queryInterface.sequelize.query(
      "SELECT lcr_pap_id_papel FROM lcr_papeis WHERE lcr_pap_nome_papel = 'revisor'",
      { type: QueryTypes.SELECT },
    );
    const idPermissao = permissoes[0]?.lcr_prm_id_permissao;
    const idPapel = revisores[0]?.lcr_pap_id_papel;
    if (!idPermissao || !idPapel) return;

    const existentes = await queryInterface.sequelize.query(
      'SELECT lcr_ppm_id_papel_permissao FROM lcr_papeis_permissoes WHERE lcr_ppm_id_papel = :idPapel AND lcr_ppm_id_permissao = :idPermissao',
      { replacements: { idPapel, idPermissao }, type: QueryTypes.SELECT },
    );
    if (existentes.length) return;
    await queryInterface.bulkInsert('lcr_papeis_permissoes', [{
      lcr_ppm_id_papel_permissao: randomUUID(),
      lcr_ppm_id_papel: idPapel,
      lcr_ppm_id_permissao: idPermissao,
      lcr_ppm_data_atribuicao: new Date(),
    }]);
  },

  async down(queryInterface) {
    // Concessão aditiva e idempotente; um vínculo já podia existir antes da
    // migration, então o rollback não deve revogar permissões do revisor.
    void queryInterface;
  },
};
