'use strict';

const { QueryTypes } = require('sequelize');
const catalogo = require('../dados_iniciais/catalogo_materiais_br.json');

const CODIGOS_LEVA = [
  'br-br-papel-papelao-rascunho-001-papel-e-papelao-secos-para-coleta-seleti-4bad42fd',
  'br-vidro-embalagens-espelhos-ceramica-embalagens-de-vidro-inteiras-garrafas-po-0efa032a',
  'br-plastics-packaging-disposal-br-embalagens-plasticas-reciclaveis-da-roti-99cfc41b',
  'br-metais-e-latas-latas-de-bebidas-e-de-alimentos-aluminio-bc4efde3',
  'br-restos-alimentares-organicos-jardi-compostagem-de-restos-de-alimentos-com-m-0307de5f',
];
const MARCADOR_CURADORIA = 'Curadoria técnica preliminar conferida em 2026-09-30 com fontes citadas. Permanece em rascunho até validação e publicação individual por revisor autenticado; confirme as regras do município ou operador antes da aprovação.';
const TEXTO_RASCUNHO_ANTERIOR = 'RASCUNHO DE PESQUISA';
const DATA_CURADORIA = '2026-09-30';

function exigirOptIn() {
  if (process.env.AMBIENTE_EXECUCAO !== 'desenvolvimento') {
    throw new Error('A preparação do lote inicial só pode rodar com AMBIENTE_EXECUCAO=desenvolvimento.');
  }
  if (process.env.LCR_PREPARAR_LEVA_GUIA_INICIAL !== 'true') {
    throw new Error('Defina LCR_PREPARAR_LEVA_GUIA_INICIAL=true para autorizar explicitamente esta atualização local.');
  }
}

function diaIso(valor) {
  if (!valor) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}

function valorJson(valor) {
  return JSON.stringify(Array.isArray(valor) ? valor : []);
}

function mapearDados(registro) {
  return {
    codigo: registro.codigoCatalogo,
    classificacao: registro.classificacao,
    nome: registro.nomeMaterial,
    categoria: registro.categoriaMaterial,
    instrucao: registro.instrucaoDescarte,
    impacto: registro.observacaoImpacto,
    sinonimos: valorJson(registro.sinonimos),
    preparacao: registro.preparacao,
    cuidados: registro.cuidados,
    categoriasPontos: valorJson(registro.categoriasPontos),
    rotasReferencia: valorJson(registro.rotasReferencia),
    abrangencia: registro.abrangencia,
    escopo: registro.notaAbrangencia,
    fontes: valorJson(registro.fontesReferencia),
    dataVerificacao: registro.dataVerificacao || DATA_CURADORIA,
    observacaoRevisao: registro.observacaoRevisao || MARCADOR_CURADORIA,
  };
}

function classificarEstado(registro) {
  const status = registro.lcr_mat_status_material;
  const versao = Number(registro.lcr_mat_versao_conteudo);
  const observacao = registro.lcr_mat_observacao_revisao || '';
  const dataVerificacao = diaIso(registro.lcr_mat_data_verificacao);
  const semPublicacao = !registro.lcr_mat_id_usuario_revisor && !registro.lcr_mat_data_publicacao;

  if (status !== 'rascunho' || !semPublicacao) return 'conflito';
  if (versao === 2 && observacao === MARCADOR_CURADORIA && dataVerificacao === DATA_CURADORIA) return 'preparado';
  if (versao === 1 && observacao === MARCADOR_CURADORIA && dataVerificacao === DATA_CURADORIA) return 'ja_curado_no_seed_inicial';
  if (versao === 1 && observacao.startsWith(TEXTO_RASCUNHO_ANTERIOR)) return 'rascunho_original';
  return 'conflito';
}

async function up(queryInterface) {
  exigirOptIn();
  const registros = catalogo.registros.filter(registro => CODIGOS_LEVA.includes(registro.codigoCatalogo));
  if (registros.length !== CODIGOS_LEVA.length) {
    throw new Error('A lista de curadoria não corresponde aos cinco registros esperados; nenhuma alteração foi aplicada.');
  }

  await queryInterface.sequelize.transaction(async transaction => {
    const existentes = await queryInterface.sequelize.query(
      `SELECT lcr_mat_codigo_catalogo, lcr_mat_status_material, lcr_mat_versao_conteudo,
              lcr_mat_observacao_revisao, lcr_mat_data_verificacao,
              lcr_mat_id_usuario_revisor, lcr_mat_data_publicacao
       FROM lcr_materiais
       WHERE lcr_mat_codigo_catalogo IN (:codigos)`,
      { replacements: { codigos: CODIGOS_LEVA }, type: QueryTypes.SELECT, transaction },
    );
    const porCodigo = new Map(existentes.map(registro => [registro.lcr_mat_codigo_catalogo, registro]));
    const ausentes = CODIGOS_LEVA.filter(codigo => !porCodigo.has(codigo));
    if (ausentes.length) {
      throw new Error(`Registros ausentes; execute primeiro o seed do catálogo. Nenhuma alteração aplicada: ${ausentes.join(', ')}.`);
    }

    const estados = registros.map(registro => ({
      registro,
      estado: classificarEstado(porCodigo.get(registro.codigoCatalogo)),
      existente: porCodigo.get(registro.codigoCatalogo),
    }));
    const conflitos = estados.filter(item => item.estado === 'conflito');
    if (conflitos.length) {
      throw new Error(`Há registros alterados, publicados ou fora do estado inicial. Nenhuma alteração aplicada: ${conflitos.map(item => item.registro.codigoCatalogo).join(', ')}.`);
    }

    let atualizados = 0;
    for (const item of estados) {
      if (item.estado !== 'rascunho_original') continue;
      const dados = mapearDados(item.registro);
      const [linhas] = await queryInterface.sequelize.query(
        `UPDATE lcr_materiais
         SET lcr_mat_classificacao = :classificacao,
             lcr_mat_nome_material = :nome,
             lcr_mat_categoria_material = :categoria,
             lcr_mat_instrucao_descarte = :instrucao,
             lcr_mat_observacao_impacto = :impacto,
             lcr_mat_sinonimos = CAST(:sinonimos AS jsonb),
             lcr_mat_preparacao = :preparacao,
             lcr_mat_cuidados = :cuidados,
             lcr_mat_categorias_pontos = CAST(:categoriasPontos AS jsonb),
             lcr_mat_rotas_referencia = CAST(:rotasReferencia AS jsonb),
             lcr_mat_abrangencia = :abrangencia,
             lcr_mat_escopo_detalhado = :escopo,
             lcr_mat_fontes_referencia = CAST(:fontes AS jsonb),
             lcr_mat_data_verificacao = :dataVerificacao,
             lcr_mat_observacao_revisao = :observacaoRevisao,
             lcr_mat_versao_conteudo = 2,
             lcr_mat_data_atualizacao = CURRENT_TIMESTAMP
         WHERE lcr_mat_codigo_catalogo = :codigo
           AND lcr_mat_status_material = 'rascunho'
           AND lcr_mat_versao_conteudo = 1
           AND lcr_mat_observacao_revisao = :observacaoOriginal
           AND lcr_mat_id_usuario_revisor IS NULL
           AND lcr_mat_data_publicacao IS NULL
         RETURNING lcr_mat_id_material`,
        {
          replacements: {
            ...dados,
            observacaoOriginal: item.existente.lcr_mat_observacao_revisao,
          },
          transaction,
        },
      );
      if (!Array.isArray(linhas) || linhas.length !== 1) {
        throw new Error(`O registro ${dados.codigo} mudou durante a operação; a transação será cancelada.`);
      }
      atualizados += 1;
    }

    if (atualizados) {
      console.log(`${atualizados} registros preparados como rascunho; nenhum material foi publicado.`);
    } else {
      console.log('Os cinco registros já estão preparados e continuam como rascunhos; nenhuma alteração necessária.');
    }
    console.log('A publicação deve ser feita por um revisor autenticado na Central de revisão para registrar autoria e auditoria.');
  });
}

async function down() {
  throw new Error('Este seeder não é reversível para não sobrescrever edições; revise ou corrija o conteúdo pela Central de revisão.');
}

module.exports = { up, down, CODIGOS_LEVA, MARCADOR_CURADORIA, DATA_CURADORIA };
