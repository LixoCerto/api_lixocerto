'use strict';

const { randomUUID } = require('node:crypto');
const { QueryTypes } = require('sequelize');

const papeis = [
  ['00000000-0000-4000-8000-000000000001', 'usuario', 'Usuario comum da plataforma'],
  ['00000000-0000-4000-8000-000000000002', 'pesquisador', 'Consulta resultados agregados da pesquisa'],
  ['00000000-0000-4000-8000-000000000003', 'revisor', 'Revisa conteudo e pontos de coleta'],
  ['00000000-0000-4000-8000-000000000004', 'administrador', 'Administra a plataforma'],
];

const permissoes = [
  ['10000000-0000-4000-8000-000000000001', 'materiais:ler', 'Ler materiais'],
  ['10000000-0000-4000-8000-000000000002', 'materiais:escrever', 'Escrever materiais'],
  ['10000000-0000-4000-8000-000000000012', 'materiais:aprovar', 'Aprovar e publicar materiais'],
  ['10000000-0000-4000-8000-000000000003', 'pontos_coleta:ler', 'Ler pontos de coleta'],
  ['10000000-0000-4000-8000-000000000004', 'pontos_coleta:aprovar', 'Aprovar pontos de coleta'],
  ['10000000-0000-4000-8000-000000000005', 'questionarios:responder', 'Responder questionarios'],
  ['10000000-0000-4000-8000-000000000006', 'questionarios:administrar', 'Administrar questionarios'],
  ['10000000-0000-4000-8000-000000000007', 'gamificacao:ler', 'Ler gamificacao'],
  ['10000000-0000-4000-8000-000000000008', 'avaliacao_usabilidade:enviar', 'Enviar avaliacao de usabilidade'],
  ['10000000-0000-4000-8000-000000000009', 'avaliacao_usabilidade:consultar_agregados', 'Consultar resultados agregados'],
  ['10000000-0000-4000-8000-000000000010', 'auditoria:consultar', 'Consultar auditoria'],
  ['10000000-0000-4000-8000-000000000011', 'administracao:consultar', 'Consultar resumo administrativo'],
  ['10000000-0000-4000-8000-000000000013', 'pontos_coleta:escrever', 'Criar e editar pontos de coleta'],
];

const permissoesPorPapel = {
  usuario: ['materiais:ler', 'pontos_coleta:ler', 'questionarios:responder', 'gamificacao:ler', 'avaliacao_usabilidade:enviar'],
  pesquisador: ['materiais:ler', 'pontos_coleta:ler', 'gamificacao:ler', 'avaliacao_usabilidade:consultar_agregados'],
  revisor: ['materiais:ler', 'materiais:escrever', 'materiais:aprovar', 'pontos_coleta:ler', 'pontos_coleta:escrever', 'pontos_coleta:aprovar', 'questionarios:administrar'],
  administrador: permissoes.map(([, codigo]) => codigo),
};

module.exports = {
  async up(queryInterface) {
    const data = new Date();
    const papeisExistentes = await queryInterface.sequelize.query(
      'SELECT lcr_pap_id_papel, lcr_pap_nome_papel FROM lcr_papeis',
      { type: QueryTypes.SELECT },
    );
    const permissoesExistentes = await queryInterface.sequelize.query(
      'SELECT lcr_prm_id_permissao, lcr_prm_codigo_permissao FROM lcr_permissoes',
      { type: QueryTypes.SELECT },
    );
    const idsPapeisExistentes = new Set(papeisExistentes.map(item => item.lcr_pap_id_papel));
    const idsPermissoesExistentes = new Set(permissoesExistentes.map(item => item.lcr_prm_id_permissao));
    const idsPapeisPorNome = new Map(papeisExistentes.map(item => [item.lcr_pap_nome_papel, item.lcr_pap_id_papel]));
    const idsPermissoesPorCodigo = new Map(permissoesExistentes.map(item => [item.lcr_prm_codigo_permissao, item.lcr_prm_id_permissao]));

    const papeisNovos = papeis
      .filter(([, nome]) => !idsPapeisPorNome.has(nome))
      .map(([idPreferencial, nome, descricao]) => {
        const id = idsPapeisExistentes.has(idPreferencial) ? randomUUID() : idPreferencial;
        idsPapeisExistentes.add(id);
        idsPapeisPorNome.set(nome, id);
        return {
          lcr_pap_id_papel: id,
          lcr_pap_nome_papel: nome,
          lcr_pap_descricao_papel: descricao,
          lcr_pap_status_papel: 'ativo',
          lcr_pap_data_criacao: data,
          lcr_pap_data_atualizacao: data,
        };
      });
    const permissoesNovas = permissoes
      .filter(([, codigo]) => !idsPermissoesPorCodigo.has(codigo))
      .map(([idPreferencial, codigo, nome]) => {
        const id = idsPermissoesExistentes.has(idPreferencial) ? randomUUID() : idPreferencial;
        idsPermissoesExistentes.add(id);
        idsPermissoesPorCodigo.set(codigo, id);
        return {
          lcr_prm_id_permissao: id,
          lcr_prm_codigo_permissao: codigo,
          lcr_prm_nome_permissao: nome,
          lcr_prm_descricao_permissao: nome,
          lcr_prm_status_permissao: 'ativo',
          lcr_prm_data_criacao: data,
          lcr_prm_data_atualizacao: data,
        };
      });
    if (papeisNovos.length) await queryInterface.bulkInsert('lcr_papeis', papeisNovos);
    if (permissoesNovas.length) await queryInterface.bulkInsert('lcr_permissoes', permissoesNovas);

    const idsPapeis = idsPapeisPorNome;
    const idsPermissoes = idsPermissoesPorCodigo;
    const relacoesExistentes = await queryInterface.sequelize.query(
      'SELECT lcr_ppm_id_papel, lcr_ppm_id_permissao FROM lcr_papeis_permissoes',
      { type: QueryTypes.SELECT },
    );
    const chavesExistentes = new Set(relacoesExistentes.map(item => `${item.lcr_ppm_id_papel}:${item.lcr_ppm_id_permissao}`));
    const relacoes = Object.entries(permissoesPorPapel).flatMap(([nomePapel, codigos], indicePapel) =>
      codigos.map((codigo, indicePermissao) => ({
        lcr_ppm_id_papel_permissao: randomUUID(),
        lcr_ppm_id_papel: idsPapeis.get(nomePapel),
        lcr_ppm_id_permissao: idsPermissoes.get(codigo),
        lcr_ppm_data_atribuicao: data,
      })),
    ).filter(relacao => !chavesExistentes.has(`${relacao.lcr_ppm_id_papel}:${relacao.lcr_ppm_id_permissao}`));
    if (relacoes.length) await queryInterface.bulkInsert('lcr_papeis_permissoes', relacoes);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('lcr_papeis_permissoes', null, {});
    await queryInterface.bulkDelete('lcr_permissoes', null, {});
    await queryInterface.bulkDelete('lcr_papeis', null, {});
  },
};
