'use strict';

const { randomUUID } = require('node:crypto');
const { QueryTypes } = require('sequelize');

const CODIGO = 'administracao:gerenciar_acessos';
const ID_PREFERENCIAL = '10000000-0000-4000-8000-000000000015';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const permissoes = await queryInterface.sequelize.query(
        'SELECT lcr_prm_id_permissao FROM lcr_permissoes WHERE lcr_prm_codigo_permissao = :codigo FOR UPDATE',
        { replacements: { codigo: CODIGO }, type: QueryTypes.SELECT, transaction },
      );
      let idPermissao = permissoes[0]?.lcr_prm_id_permissao;
      if (!idPermissao) {
        const ids = await queryInterface.sequelize.query(
          'SELECT lcr_prm_id_permissao FROM lcr_permissoes WHERE lcr_prm_id_permissao = :id',
          { replacements: { id: ID_PREFERENCIAL }, type: QueryTypes.SELECT, transaction },
        );
        idPermissao = ids.length ? randomUUID() : ID_PREFERENCIAL;
        const agora = new Date();
        await queryInterface.bulkInsert('lcr_permissoes', [{
          lcr_prm_id_permissao: idPermissao,
          lcr_prm_codigo_permissao: CODIGO,
          lcr_prm_nome_permissao: 'Gerenciar acessos',
          lcr_prm_descricao_permissao: 'Gerenciar usuários, papéis e matriz de permissões',
          lcr_prm_status_permissao: 'ativo',
          lcr_prm_data_criacao: agora,
          lcr_prm_data_atualizacao: agora,
        }], { transaction });
      }
      const papeis = await queryInterface.sequelize.query(
        "SELECT lcr_pap_id_papel FROM lcr_papeis WHERE lcr_pap_nome_papel = 'administrador' AND lcr_pap_status_papel = 'ativo' FOR UPDATE",
        { type: QueryTypes.SELECT, transaction },
      );
      // Migrations rodam antes dos seeds em uma instalação limpa. Nesse caso,
      // o seed inicial associa a permissão ao papel administrador depois.
      if (papeis[0]) {
        const relacoes = await queryInterface.sequelize.query(
          'SELECT lcr_ppm_id_papel_permissao FROM lcr_papeis_permissoes WHERE lcr_ppm_id_papel = :idPapel AND lcr_ppm_id_permissao = :idPermissao',
          { replacements: { idPapel: papeis[0].lcr_pap_id_papel, idPermissao }, type: QueryTypes.SELECT, transaction },
        );
        if (!relacoes.length) {
          await queryInterface.bulkInsert('lcr_papeis_permissoes', [{
            lcr_ppm_id_papel_permissao: randomUUID(),
            lcr_ppm_id_papel: papeis[0].lcr_pap_id_papel,
            lcr_ppm_id_permissao: idPermissao,
            lcr_ppm_data_atribuicao: new Date(),
          }], { transaction });
        }
      }
      await transaction.commit();
    } catch (erro) {
      await transaction.rollback();
      throw erro;
    }
  },

  // Migration de dados. A permissão fica no catálogo para não apagar uma atribuição
  // que possa ter sido reutilizada após o deploy; a aplicação reserva seu uso ao admin.
  async down() {},
};
