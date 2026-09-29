import { Metadata } from '@grpc/grpc-js';
import { BadRequestException, Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { ServicoAutenticacao } from '../autenticacao/autenticacao.servico.js';
import { ServicoAutorizacao } from '../autorizacao/autorizacao.servico.js';
import { ServicoAuditoria } from '../auditoria/auditoria.servico.js';
import { ServicoUsuarios } from '../usuarios/usuarios.servico.js';
import { DadosMaterial, FonteMaterial, StatusMaterial } from './materiais.repositorio.js';
import { ServicoMateriais } from './materiais.servico.js';

type RequisicaoDadosMaterial = {
  codigo_catalogo?: string;
  classificacao?: string;
  nome_material?: string;
  categoria_material?: string;
  instrucao_descarte?: string;
  observacao_impacto?: string;
  sinonimos?: string[];
  preparacao?: string;
  cuidados?: string;
  categorias_pontos?: string[];
  rotas_referencia?: string[];
  abrangencia?: string;
  nota_abrangencia?: string;
  fontes_referencia?: FonteMaterial[];
  data_verificacao?: string;
};
type MaterialResposta = RequisicaoDadosMaterial & {
  id_material: string;
  status_material: string;
  versao_conteudo: number;
  observacao_revisao: string;
};

@Controller()
export class ControladorGrpcMateriais {
  constructor(
    private readonly servico: ServicoMateriais,
    private readonly autenticacao: ServicoAutenticacao,
    private readonly autorizacao: ServicoAutorizacao,
    private readonly usuarios: ServicoUsuarios,
    private readonly auditoria: ServicoAuditoria,
  ) {}

  @GrpcMethod('ServicoMateriais', 'ListarMateriais')
  async listarMateriais(requisicao: { texto_pesquisa?: string; categoria_material?: string; status_material?: string; numero_pagina?: number; tamanho_pagina?: number }, metadados: Metadata) {
    const identidade = await this.obterIdentidade(metadados);
    this.autorizacao.exigirPermissao(identidade, 'materiais:ler');
    const podeGerenciar = this.autorizacao.temPermissao(identidade, 'materiais:escrever');
    const resultado = await this.servico.listar({
      textoPesquisa: requisicao.texto_pesquisa,
      categoriaMaterial: requisicao.categoria_material,
      statusMaterial: requisicao.status_material as StatusMaterial | 'todos',
      numeroPagina: requisicao.numero_pagina,
      tamanhoPagina: requisicao.tamanho_pagina,
    }, podeGerenciar);
    return { materiais: resultado.materiais.map(material => this.mapear(material)), quantidade_total: resultado.quantidadeTotal };
  }

  @GrpcMethod('ServicoMateriais', 'ObterMaterial')
  async obterMaterial(requisicao: { id_material?: string }, metadados: Metadata) {
    const identidade = await this.obterIdentidade(metadados);
    this.autorizacao.exigirPermissao(identidade, 'materiais:ler');
    const material = await this.servico.obter(requisicao.id_material ?? '');
    const podeGerenciar = this.autorizacao.temPermissao(identidade, 'materiais:escrever');
    if (!material || (material.lcr_mat_status_material !== 'publicado' && !podeGerenciar)) return { encontrado: false, material: {} };
    return { encontrado: true, material: this.mapear(material) };
  }

  @GrpcMethod('ServicoMateriais', 'CriarMaterial')
  async criarMaterial(requisicao: { dados?: RequisicaoDadosMaterial }, metadados: Metadata) {
    const { idUsuario } = await this.obterUsuario(metadados, 'materiais:escrever');
    const material = await this.servico.criar(this.converterDados(requisicao.dados ?? {}), idUsuario);
    if (material) await this.registrarAuditoria('material_criado', material.lcr_mat_id_material, idUsuario, metadados);
    return { operacao_aceita: Boolean(material), mensagem_resultado: material ? 'Material salvo como rascunho para revisão.' : 'Banco de dados indisponível.', material: material ? this.mapear(material) : {} };
  }

  @GrpcMethod('ServicoMateriais', 'AtualizarMaterial')
  async atualizarMaterial(requisicao: { id_material?: string; dados?: RequisicaoDadosMaterial }, metadados: Metadata) {
    const { idUsuario } = await this.obterUsuario(metadados, 'materiais:escrever');
    const material = await this.servico.atualizar(requisicao.id_material ?? '', this.converterDados(requisicao.dados ?? {}), idUsuario);
    if (material) await this.registrarAuditoria('material_atualizado', material.lcr_mat_id_material, idUsuario, metadados);
    return { operacao_aceita: Boolean(material), mensagem_resultado: material ? 'Material atualizado e devolvido a rascunho para revisão.' : 'Material não encontrado ou arquivado.', material: material ? this.mapear(material) : {} };
  }

  @GrpcMethod('ServicoMateriais', 'AlterarStatusMaterial')
  async alterarStatusMaterial(requisicao: { id_material?: string; status_material?: string; observacao_revisao?: string }, metadados: Metadata) {
    const status = requisicao.status_material ?? 'rascunho';
    const permissao = status === 'publicado' ? 'materiais:aprovar' : 'materiais:escrever';
    const { idUsuario } = await this.obterUsuario(metadados, permissao);
    if (status === 'publicado') {
      const materialAtual = await this.servico.obter(requisicao.id_material ?? '');
      if (!materialAtual) return { operacao_aceita: false, mensagem_resultado: 'Material não encontrado.', material: {} };
      if (materialAtual.lcr_mat_fontes_referencia.length === 0) throw new BadRequestException('Inclua ao menos uma fonte antes de publicar.');
    }
    const material = await this.servico.alterarStatus(requisicao.id_material ?? '', status, idUsuario, requisicao.observacao_revisao ?? '');
    if (material) await this.registrarAuditoria(`material_${status}`, material.lcr_mat_id_material, idUsuario, metadados);
    return { operacao_aceita: Boolean(material), mensagem_resultado: material ? (status === 'publicado' ? 'Material publicado.' : status === 'arquivado' ? 'Material arquivado.' : 'Material devolvido a rascunho.') : 'Material não encontrado.', material: material ? this.mapear(material) : {} };
  }

  private async obterIdentidade(metadados: Metadata) {
    const valor = metadados.get('authorization')[0];
    const autorizacao = Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
    return this.autenticacao.obterIdentidadeAtual(autorizacao);
  }

  private async obterUsuario(metadados: Metadata, permissao: string) {
    const identidade = await this.obterIdentidade(metadados);
    this.autorizacao.exigirPermissao(identidade, permissao);
    const idUsuario = await this.usuarios.obterIdInterno(identidade.idExterno);
    if (!idUsuario) throw new Error('Usuário autenticado sem registro interno');
    return { idUsuario };
  }

  private converterDados(requisicao: RequisicaoDadosMaterial): DadosMaterial {
    return {
      codigoCatalogo: requisicao.codigo_catalogo,
      classificacao: requisicao.classificacao ?? '',
      nomeMaterial: requisicao.nome_material ?? '',
      categoriaMaterial: requisicao.categoria_material ?? '',
      instrucaoDescarte: requisicao.instrucao_descarte ?? '',
      observacaoImpacto: requisicao.observacao_impacto ?? '',
      sinonimos: requisicao.sinonimos ?? [],
      preparacao: requisicao.preparacao ?? '',
      cuidados: requisicao.cuidados ?? '',
      categoriasPontos: requisicao.categorias_pontos ?? [],
      rotasReferencia: requisicao.rotas_referencia ?? [],
      abrangencia: requisicao.abrangencia ?? '',
      notaAbrangencia: requisicao.nota_abrangencia ?? '',
      fontesReferencia: requisicao.fontes_referencia ?? [],
      dataVerificacao: requisicao.data_verificacao ?? null,
    };
  }

  private mapear(material: any): MaterialResposta {
    return {
      id_material: material.lcr_mat_id_material,
      codigo_catalogo: material.lcr_mat_codigo_catalogo ?? '',
      classificacao: material.lcr_mat_classificacao ?? '',
      nome_material: material.lcr_mat_nome_material,
      categoria_material: material.lcr_mat_categoria_material,
      instrucao_descarte: material.lcr_mat_instrucao_descarte,
      observacao_impacto: material.lcr_mat_observacao_impacto ?? '',
      sinonimos: material.lcr_mat_sinonimos ?? [],
      preparacao: material.lcr_mat_preparacao ?? '',
      cuidados: material.lcr_mat_cuidados ?? '',
      categorias_pontos: material.lcr_mat_categorias_pontos ?? [],
      rotas_referencia: material.lcr_mat_rotas_referencia ?? [],
      abrangencia: material.lcr_mat_abrangencia ?? 'confirmar_localmente',
      nota_abrangencia: material.lcr_mat_escopo_detalhado ?? '',
      fontes_referencia: material.lcr_mat_fontes_referencia ?? [],
      data_verificacao: material.lcr_mat_data_verificacao ?? '',
      status_material: material.lcr_mat_status_material,
      versao_conteudo: material.lcr_mat_versao_conteudo,
      observacao_revisao: material.lcr_mat_observacao_revisao ?? '',
    };
  }

  private registrarAuditoria(tipoEvento: string, idRecurso: string | undefined, idUsuario: string, metadados: Metadata) {
    return this.auditoria.registrar({ idUsuario, tipoEvento, recursoEvento: 'material', idRecurso, idCorrelacao: this.obterCorrelacao(metadados), detalhesEvento: { recurso: 'material' } });
  }

  private obterCorrelacao(metadados: Metadata) {
    const valor = metadados.get('x-id-correlacao')[0];
    return typeof valor === 'string' && valor.trim() ? valor.slice(0, 120) : randomUUID();
  }
}
