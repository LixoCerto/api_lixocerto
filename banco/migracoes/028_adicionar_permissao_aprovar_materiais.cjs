'use strict';

const { randomUUID } = require('node:crypto');
const { QueryTypes } = require('sequelize');

const codigo = 'materiais:aprovar';
const idPadrao = '10000000-0000-4000-8000-000000000012';

module.exports = {
  async up(queryInterface) {
    const existentes = await queryInterface.sequelize.query(
      'SELECT lcr_prm_id_permissao FROM lcr_permissoes WHERE lcr_prm_codigo_permissao = :codigo',
      { replacements: { codigo }, type: QueryTypes.SELECT },
    );
    let idPermissao = existentes[0]?.lcr_prm_id_permissao;
    if (!idPermissao) {
      const idsOcupados = await queryInterface.sequelize.query(
        'SELECT lcr_prm_id_permissao FROM lcr_permissoes WHERE lcr_prm_id_permissao = :id',
        { replacements: { id: idPadrao }, type: QueryTypes.SELECT },
      );
      idPermissao = idsOcupados.length ? randomUUID() : idPadrao;
      const agora = new Date();
      await queryInterface.bulkInsert('lcr_permissoes', [{
        lcr_prm_id_permissao: idPermissao,
        lcr_prm_codigo_permissao: codigo,
        lcr_prm_nome_permissao: 'Aprovar e publicar materiais',
        lcr_prm_descricao_permissao: 'Aprovar e publicar materiais',
        lcr_prm_status_permissao: 'ativo',
        lcr_prm_data_criacao: agora,
        lcr_prm_data_atualizacao: agora,
      }]);
    }

    const papeis = await queryInterface.sequelize.query(
      "SELECT lcr_pap_id_papel FROM lcr_papeis WHERE lcr_pap_nome_papel IN ('revisor', 'administrador')",
      { type: QueryTypes.SELECT },
    );
    const existentesRelacao = await queryInterface.sequelize.query(
      'SELECT lcr_ppm_id_papel FROM lcr_papeis_permissoes WHERE lcr_ppm_id_permissao = :idPermissao',
      { replacements: { idPermissao }, type: QueryTypes.SELECT },
    );
    const papeisRelacionados = new Set(existentesRelacao.map(item => item.lcr_ppm_id_papel));
    const agora = new Date();
    const relacoes = papeis
      .filter(papel => !papeisRelacionados.has(papel.lcr_pap_id_papel))
      .map(papel => ({
        lcr_ppm_id_papel_permissao: randomUUID(),
        lcr_ppm_id_papel: papel.lcr_pap_id_papel,
        lcr_ppm_id_permissao: idPermissao,
        lcr_ppm_data_atribuicao: agora,
      }));
    if (relacoes.length) await queryInterface.bulkInsert('lcr_papeis_permissoes', relacoes);
  },

  async down(queryInterface) {
    const permissoes = await queryInterface.sequelize.query(
      'SELECT lcr_prm_id_permissao FROM lcr_permissoes WHERE lcr_prm_codigo_permissao = :codigo',
      { replacements: { codigo }, type: QueryTypes.SELECT },
    );
    const idPermissao = permissoes[0]?.lcr_prm_id_permissao;
    if (!idPermissao) return;
    await queryInterface.bulkDelete('lcr_papeis_permissoes', { lcr_ppm_id_permissao: idPermissao });
    await queryInterface.bulkDelete('lcr_permissoes', { lcr_prm_id_permissao: idPermissao });
  },
};
