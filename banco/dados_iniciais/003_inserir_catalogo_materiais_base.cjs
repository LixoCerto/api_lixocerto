'use strict';

const { randomUUID } = require('node:crypto');
const { Op, QueryTypes } = require('sequelize');
const catalogo = require('./catalogo_materiais_br.json');

module.exports = {
  async up(queryInterface) {
    const existentes = await queryInterface.sequelize.query(
      'SELECT lcr_mat_codigo_catalogo FROM lcr_materiais WHERE lcr_mat_codigo_catalogo IS NOT NULL',
      { type: QueryTypes.SELECT },
    );
    const codigosExistentes = new Set(existentes.map(registro => registro.lcr_mat_codigo_catalogo));
    const agora = new Date();
    const novos = catalogo.registros
      .filter(registro => !codigosExistentes.has(registro.codigoCatalogo))
      .map(registro => ({
        lcr_mat_id_material: randomUUID(),
        lcr_mat_codigo_catalogo: registro.codigoCatalogo,
        lcr_mat_classificacao: registro.classificacao,
        lcr_mat_nome_material: registro.nomeMaterial,
        lcr_mat_categoria_material: registro.categoriaMaterial,
        lcr_mat_instrucao_descarte: registro.instrucaoDescarte,
        lcr_mat_observacao_impacto: registro.observacaoImpacto,
        lcr_mat_sinonimos: JSON.stringify(registro.sinonimos),
        lcr_mat_preparacao: registro.preparacao,
        lcr_mat_cuidados: registro.cuidados,
        lcr_mat_categorias_pontos: JSON.stringify(registro.categoriasPontos),
        lcr_mat_rotas_referencia: JSON.stringify(registro.rotasReferencia),
        lcr_mat_abrangencia: registro.abrangencia,
        lcr_mat_escopo_detalhado: registro.notaAbrangencia,
        lcr_mat_fontes_referencia: JSON.stringify(registro.fontesReferencia),
        lcr_mat_data_verificacao: null,
        lcr_mat_observacao_revisao: registro.observacaoRevisao,
        lcr_mat_id_usuario_criador: null,
        lcr_mat_id_usuario_editor: null,
        lcr_mat_id_usuario_revisor: null,
        lcr_mat_data_publicacao: null,
        lcr_mat_icone_material: null,
        lcr_mat_versao_conteudo: 1,
        lcr_mat_status_material: 'rascunho',
        lcr_mat_data_criacao: agora,
        lcr_mat_data_atualizacao: agora,
      }));

    if (novos.length) await queryInterface.bulkInsert('lcr_materiais', novos);
  },

  async down(queryInterface) {
    const codigos = catalogo.registros.map(registro => registro.codigoCatalogo);
    await queryInterface.bulkDelete('lcr_materiais', {
      lcr_mat_codigo_catalogo: { [Op.in]: codigos },
    });
  },
};
