'use strict';

const { randomUUID } = require('node:crypto');
const { QueryTypes } = require('sequelize');

const codigoPermissao = 'pontos_coleta:escrever';
const idPreferencial = '10000000-0000-4000-8000-000000000013';
const papeisAlvo = ['revisor', 'administrador'];

module.exports = {
  async up(queryInterface) {
    const [permissaoExistente] = await queryInterface.sequelize.query(
      `SELECT lcr_prm_id_permissao
       FROM lcr_permissoes
       WHERE lcr_prm_codigo_permissao = :codigo
       LIMIT 1`,
      { replacements: { codigo: codigoPermissao }, type: QueryTypes.SELECT },
    );

    let idPermissao = permissaoExistente?.lcr_prm_id_permissao;
    if (!idPermissao) {
      const [idPreferencialOcupado] = await queryInterface.sequelize.query(
        `SELECT lcr_prm_id_permissao
         FROM lcr_permissoes
         WHERE lcr_prm_id_permissao = :id
         LIMIT 1`,
        { replacements: { id: idPreferencial }, type: QueryTypes.SELECT },
      );
      idPermissao = idPreferencialOcupado ? randomUUID() : idPreferencial;
      const agora = new Date();
      await queryInterface.bulkInsert('lcr_permissoes', [{
        lcr_prm_id_permissao: idPermissao,
        lcr_prm_codigo_permissao: codigoPermissao,
        lcr_prm_nome_permissao: 'Criar e editar pontos de coleta',
        lcr_prm_descricao_permissao: 'Criar e editar pontos de coleta',
        lcr_prm_status_permissao: 'ativo',
        lcr_prm_data_criacao: agora,
        lcr_prm_data_atualizacao: agora,
      }]);
    } else {
      await queryInterface.bulkUpdate(
        'lcr_permissoes',
        { lcr_prm_status_permissao: 'ativo', lcr_prm_data_atualizacao: new Date() },
        { lcr_prm_id_permissao: idPermissao },
      );
    }

    const papeis = await queryInterface.sequelize.query(
      `SELECT lcr_pap_id_papel, lcr_pap_nome_papel
       FROM lcr_papeis
       WHERE lcr_pap_nome_papel IN (:nomes)
         AND lcr_pap_status_papel = 'ativo'`,
      { replacements: { nomes: papeisAlvo }, type: QueryTypes.SELECT },
    );
    const relacoesExistentes = await queryInterface.sequelize.query(
      `SELECT lcr_ppm_id_papel, lcr_ppm_id_permissao
       FROM lcr_papeis_permissoes
       WHERE lcr_ppm_id_permissao = :idPermissao`,
      { replacements: { idPermissao }, type: QueryTypes.SELECT },
    );
    const relacoesExistentesSet = new Set(
      relacoesExistentes.map(relacao => `${relacao.lcr_ppm_id_papel}:${relacao.lcr_ppm_id_permissao}`),
    );
    const novasRelacoes = papeis
      .filter(papel => !relacoesExistentesSet.has(`${papel.lcr_pap_id_papel}:${idPermissao}`))
      .map(papel => ({
        lcr_ppm_id_papel_permissao: randomUUID(),
        lcr_ppm_id_papel: papel.lcr_pap_id_papel,
        lcr_ppm_id_permissao: idPermissao,
        lcr_ppm_data_atribuicao: new Date(),
      }));

    if (novasRelacoes.length) {
      await queryInterface.bulkInsert('lcr_papeis_permissoes', novasRelacoes);
    }
  },
};
