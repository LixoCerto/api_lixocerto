'use strict';

const { literal } = require('sequelize');
const catalogo = require('./catalogo_materiais_br.json');

const codigosRevisados = new Set([
  'br-br-papel-papelao-rascunho-001-papel-e-papelao-secos-para-coleta-seleti-4bad42fd',
  'br-vidro-embalagens-espelhos-ceramica-embalagens-de-vidro-inteiras-garrafas-po-0efa032a',
  'br-plastics-packaging-disposal-br-embalagens-plasticas-reciclaveis-da-roti-99cfc41b',
  'br-metais-e-latas-latas-de-bebidas-e-de-alimentos-aluminio-bc4efde3',
  'br-restos-alimentares-organicos-jardi-compostagem-de-restos-de-alimentos-com-m-0307de5f',
]);

function camposRevisados(registro) {
  return {
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
    lcr_mat_data_verificacao: registro.dataVerificacao || null,
    lcr_mat_observacao_revisao: registro.observacaoRevisao,
    lcr_mat_versao_conteudo: literal('lcr_mat_versao_conteudo + 1'),
    lcr_mat_data_atualizacao: new Date(),
  };
}

module.exports = {
  async up(queryInterface) {
    const registros = catalogo.registros.filter(registro => codigosRevisados.has(registro.codigoCatalogo));
    if (registros.length !== codigosRevisados.size) {
      throw new Error('O catálogo não contém todos os códigos revisados esperados.');
    }

    for (const registro of registros) {
      const resultado = await queryInterface.bulkUpdate(
        'lcr_materiais',
        camposRevisados(registro),
        {
          lcr_mat_codigo_catalogo: registro.codigoCatalogo,
          lcr_mat_status_material: 'rascunho',
        },
      );
      const quantidade = Array.isArray(resultado) ? resultado[0] : resultado;
      if (quantidade !== 1) {
        throw new Error(`A ficha ${registro.codigoCatalogo} não está em rascunho ou não existe; revisão requer ação manual.`);
      }
    }

    console.log(`Fichas revisadas atualizadas: ${registros.length}. Status preservado como rascunho para aprovação administrativa.`);
  },

  async down() {
    throw new Error('As correções editoriais não são revertidas automaticamente; restaure o JSON anterior mediante revisão humana.');
  },
};
