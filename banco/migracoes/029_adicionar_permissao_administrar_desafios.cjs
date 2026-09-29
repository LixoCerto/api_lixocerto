'use strict';

const { randomUUID } = require('node:crypto');
const { QueryTypes } = require('sequelize');
const CODIGO = 'gamificacao:administrar';
const ID_PREFERENCIAL = '10000000-0000-4000-8000-000000000014';

module.exports = {
  async up(queryInterface) {
    const data = new Date();
    const permissoes = await queryInterface.sequelize.query(
      'SELECT lcr_prm_id_permissao, lcr_prm_codigo_permissao FROM lcr_permissoes',
      { type: QueryTypes.SELECT },
    );
    let idPermissao = permissoes.find(item => item.lcr_prm_codigo_permissao === CODIGO)?.lcr_prm_id_permissao;
    if (!idPermissao) {
      const idsExistentes = new Set(permissoes.map(item => item.lcr_prm_id_permissao));
      idPermissao = idsExistentes.has(ID_PREFERENCIAL) ? randomUUID() : ID_PREFERENCIAL;
      await queryInterface.bulkInsert('lcr_permissoes', [{
        lcr_prm_id_permissao: idPermissao,
        lcr_prm_codigo_permissao: CODIGO,
        lcr_prm_nome_permissao: 'Administrar desafios',
        lcr_prm_descricao_permissao: 'Criar, editar, publicar e arquivar desafios de gamificação',
        lcr_prm_status_permissao: 'ativo',
        lcr_prm_data_criacao: data,
        lcr_prm_data_atualizacao: data,
      }]);
    }

    const papeis = await queryInterface.sequelize.query(
      "SELECT lcr_pap_id_papel, lcr_pap_nome_papel FROM lcr_papeis WHERE lcr_pap_nome_papel IN ('revisor', 'administrador')",
      { type: QueryTypes.SELECT },
    );
    const relacoes = await queryInterface.sequelize.query(
      'SELECT lcr_ppm_id_papel, lcr_ppm_id_permissao FROM lcr_papeis_permissoes',
      { type: QueryTypes.SELECT },
    );
    const existentes = new Set(relacoes.map(item => `${item.lcr_ppm_id_papel}:${item.lcr_ppm_id_permissao}`));
    const novas = papeis
      .filter(papel => !existentes.has(`${papel.lcr_pap_id_papel}:${idPermissao}`))
      .map(papel => ({
        lcr_ppm_id_papel_permissao: randomUUID(),
        lcr_ppm_id_papel: papel.lcr_pap_id_papel,
        lcr_ppm_id_permissao: idPermissao,
        lcr_ppm_data_atribuicao: data,
      }));
    if (novas.length) await queryInterface.bulkInsert('lcr_papeis_permissoes', novas);
  },

  async down(queryInterface) {
    // Esta migration é aditiva: o vínculo ou a permissão podem ter sido criados
    // previamente pelo seed ou atribuídos manualmente. Não revogar acessos no
    // rollback evita remover concessões que não pertencem a esta migration.
    void queryInterface;
  },
};
