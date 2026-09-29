import { Inject, Injectable } from '@nestjs/common';
import { Op, Sequelize } from 'sequelize';
import { ModeloMaterial } from '../../infraestrutura/banco/modelos/material.modelo.js';

export type StatusMaterial = 'rascunho' | 'publicado' | 'arquivado';
export interface FonteMaterial {
  titulo: string;
  url: string;
  comprova: string;
}
export interface DadosMaterial {
  codigoCatalogo?: string | null;
  classificacao?: string;
  nomeMaterial: string;
  categoriaMaterial: string;
  instrucaoDescarte: string;
  observacaoImpacto: string;
  sinonimos: string[];
  preparacao: string;
  cuidados: string;
  categoriasPontos: string[];
  rotasReferencia?: string[];
  abrangencia: string;
  notaAbrangencia?: string;
  fontesReferencia: FonteMaterial[];
  dataVerificacao?: string | null;
}
export interface FiltroMateriais {
  textoPesquisa?: string;
  categoriaMaterial?: string;
  statusMaterial?: StatusMaterial | 'todos';
  numeroPagina?: number;
  tamanhoPagina?: number;
}

@Injectable()
export class RepositorioMateriais {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async listar(filtro: FiltroMateriais, incluirTodos = false) {
    if (!this.banco) return { materiais: [], quantidadeTotal: 0 };
    const numeroPagina = Math.max(1, filtro.numeroPagina ?? 1);
    const tamanhoPagina = Math.min(100, Math.max(1, filtro.tamanhoPagina ?? 30));
    const condicoes: Record<string, unknown> = {};
    if (incluirTodos) {
      if (filtro.statusMaterial && filtro.statusMaterial !== 'todos') condicoes.lcr_mat_status_material = filtro.statusMaterial;
    } else {
      condicoes.lcr_mat_status_material = 'publicado';
    }
    if (filtro.categoriaMaterial?.trim()) condicoes.lcr_mat_categoria_material = filtro.categoriaMaterial.trim();
    const texto = filtro.textoPesquisa?.trim();
    if (texto) {
      condicoes[Op.or as unknown as string] = [
        { lcr_mat_nome_material: { [Op.iLike]: `%${texto}%` } },
        { lcr_mat_categoria_material: { [Op.iLike]: `%${texto}%` } },
        { lcr_mat_classificacao: { [Op.iLike]: `%${texto}%` } },
        { lcr_mat_instrucao_descarte: { [Op.iLike]: `%${texto}%` } },
        { lcr_mat_preparacao: { [Op.iLike]: `%${texto}%` } },
        { lcr_mat_cuidados: { [Op.iLike]: `%${texto}%` } },
        { lcr_mat_escopo_detalhado: { [Op.iLike]: `%${texto}%` } },
        Sequelize.where(Sequelize.cast(Sequelize.col('lcr_mat_sinonimos'), 'text'), { [Op.iLike]: `%${texto}%` }),
        Sequelize.where(Sequelize.cast(Sequelize.col('lcr_mat_rotas_referencia'), 'text'), { [Op.iLike]: `%${texto}%` }),
      ];
    }
    const resultado = await ModeloMaterial.findAndCountAll({
      where: condicoes,
      order: [['lcr_mat_categoria_material', 'ASC'], ['lcr_mat_nome_material', 'ASC']],
      limit: tamanhoPagina,
      offset: (numeroPagina - 1) * tamanhoPagina,
    });
    return { materiais: resultado.rows, quantidadeTotal: resultado.count };
  }

  obter(id: string) {
    return this.banco ? ModeloMaterial.findByPk(id) : Promise.resolve(null);
  }

  async criar(dados: DadosMaterial, idUsuario: string) {
    if (!this.banco) return null;
    return ModeloMaterial.create({
      ...dadosParaModelo(dados),
      lcr_mat_status_material: 'rascunho',
      lcr_mat_id_usuario_criador: idUsuario,
      lcr_mat_id_usuario_editor: idUsuario,
      lcr_mat_versao_conteudo: 1,
      lcr_mat_data_criacao: new Date(),
      lcr_mat_data_atualizacao: new Date(),
    } as any);
  }

  async atualizar(id: string, dados: DadosMaterial, idUsuario: string) {
    const material = await this.obter(id);
    if (!material || material.lcr_mat_status_material === 'arquivado') return null;
    await material.update({
      ...dadosParaModelo(dados),
      lcr_mat_status_material: 'rascunho',
      lcr_mat_versao_conteudo: material.lcr_mat_versao_conteudo + 1,
      lcr_mat_data_verificacao: null,
      lcr_mat_observacao_revisao: null,
      lcr_mat_id_usuario_editor: idUsuario,
      lcr_mat_id_usuario_revisor: null,
      lcr_mat_data_publicacao: null,
      lcr_mat_data_atualizacao: new Date(),
    });
    return material;
  }

  async alterarStatus(id: string, status: StatusMaterial, idUsuario: string, observacaoRevisao = '') {
    const material = await this.obter(id);
    if (!material) return null;
    const agora = new Date();
    await material.update({
      lcr_mat_status_material: status,
      lcr_mat_observacao_revisao: observacaoRevisao.trim() || null,
      lcr_mat_id_usuario_revisor: status === 'publicado' ? idUsuario : null,
      lcr_mat_data_verificacao: status === 'publicado' ? agora.toISOString().slice(0, 10) : null,
      lcr_mat_data_publicacao: status === 'publicado' ? agora : null,
      lcr_mat_data_atualizacao: agora,
    });
    return material;
  }
}

function dadosParaModelo(dados: DadosMaterial): Record<string, unknown> {
  return {
    lcr_mat_codigo_catalogo: dados.codigoCatalogo || null,
    lcr_mat_classificacao: dados.classificacao ?? '',
    lcr_mat_nome_material: dados.nomeMaterial,
    lcr_mat_categoria_material: dados.categoriaMaterial,
    lcr_mat_instrucao_descarte: dados.instrucaoDescarte,
    lcr_mat_observacao_impacto: dados.observacaoImpacto,
    lcr_mat_sinonimos: dados.sinonimos,
    lcr_mat_preparacao: dados.preparacao,
    lcr_mat_cuidados: dados.cuidados,
    lcr_mat_categorias_pontos: dados.categoriasPontos,
    lcr_mat_rotas_referencia: dados.rotasReferencia ?? [],
    lcr_mat_abrangencia: dados.abrangencia,
    lcr_mat_escopo_detalhado: dados.notaAbrangencia ?? '',
    lcr_mat_fontes_referencia: dados.fontesReferencia,
    lcr_mat_data_verificacao: dados.dataVerificacao || null,
  };
}
