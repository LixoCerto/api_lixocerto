import { Metadata } from '@grpc/grpc-js';
import { Controller, ServiceUnavailableException } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { ServicoAutenticacao } from '../autenticacao/autenticacao.servico.js';
import { ServicoAutorizacao } from '../autorizacao/autorizacao.servico.js';
import { ServicoAuditoria } from '../auditoria/auditoria.servico.js';
import { ServicoRateLimit } from '../../infraestrutura/cache/rate_limit.servico.js';
import { ServicoUsuarios } from '../usuarios/usuarios.servico.js';
import { CriterioDesafio, DadosDesafio, ResumoDesafio, StatusDesafio } from './desafios.repositorio.js';
import { ServicoDesafios } from './desafios.servico.js';

interface DesafioGrpc {
  id_desafio: string;
  nome_desafio: string;
  descricao_desafio: string;
  tipo_acao: string;
  meta_quantidade: number;
  quantidade_pontos: number;
  status_desafio: string;
  quantidade_progresso: number;
  status_participacao: string;
  periodicidade: string;
  periodo_chave: string;
  criterios: Array<{ tipo: string; meta: number; categoria: string; tema: string; categorias: string[] }>;
  progresso_criterios: Array<{ criterio: { tipo: string; meta: number; categoria: string; tema: string; categorias: string[] }; progresso: number; concluido: boolean }>;
  data_fim_periodo: string;
}
type RequisicaoDadosDesafio = {
  nome_desafio?: string;
  descricao_desafio?: string;
  tipo_acao?: string;
  meta_quantidade?: number;
  quantidade_pontos?: number;
  data_inicio?: string;
  data_fim?: string;
  periodicidade?: string;
  criterios?: Array<{ tipo?: string; meta?: number; categoria?: string; tema?: string; categorias?: string[] }>;
};

@Controller()
export class ControladorGrpcDesafios {
  constructor(
    private readonly servico: ServicoDesafios,
    private readonly autenticacao: ServicoAutenticacao,
    private readonly autorizacao: ServicoAutorizacao,
    private readonly usuarios: ServicoUsuarios,
    private readonly rateLimit: ServicoRateLimit,
    private readonly auditoria: ServicoAuditoria,
  ) {}

  @GrpcMethod('ServicoDesafios', 'ListarDesafios')
  async listarDesafios(requisicao: { numero_pagina?: number; tamanho_pagina?: number }, metadados: Metadata): Promise<{ desafios: DesafioGrpc[] }> {
    const idUsuario = await this.obterUsuario(metadados, 'gamificacao:ler');
    const desafios = await this.servico.listar(idUsuario, requisicao.numero_pagina, requisicao.tamanho_pagina);
    return { desafios: desafios.map(desafio => this.mapearDesafio(desafio)) };
  }

  @GrpcMethod('ServicoDesafios', 'ListarDesafiosGestao')
  async listarDesafiosGestao(requisicao: { texto_pesquisa?: string; status_desafio?: string; numero_pagina?: number; tamanho_pagina?: number }, metadados: Metadata) {
    await this.obterUsuario(metadados, 'gamificacao:administrar');
    const resultado = await this.servico.listarGestao({
      textoPesquisa: requisicao.texto_pesquisa,
      status: requisicao.status_desafio as StatusDesafio | 'todos' | undefined,
      numeroPagina: requisicao.numero_pagina,
      tamanhoPagina: requisicao.tamanho_pagina,
    });
    return { desafios: resultado.desafios.map(desafio => this.mapearGestao(desafio)), quantidade_total: resultado.quantidadeTotal };
  }

  @GrpcMethod('ServicoDesafios', 'CriarDesafio')
  async criarDesafio(requisicao: { dados?: RequisicaoDadosDesafio }, metadados: Metadata) {
    const idUsuario = await this.obterUsuario(metadados, 'gamificacao:administrar');
    const desafio = await this.servico.criar(this.converterDados(requisicao.dados ?? {}));
    if (desafio) await this.registrarAuditoria('desafio_criado', desafio.lcr_des_id_desafio, idUsuario, metadados);
    return { operacao_aceita: Boolean(desafio), mensagem_resultado: desafio ? 'Desafio salvo como rascunho.' : 'Banco de dados indisponível.', desafio: desafio ? this.mapearGestao(desafio) : {} };
  }

  @GrpcMethod('ServicoDesafios', 'AtualizarDesafio')
  async atualizarDesafio(requisicao: { id_desafio?: string; dados?: RequisicaoDadosDesafio }, metadados: Metadata) {
    const idUsuario = await this.obterUsuario(metadados, 'gamificacao:administrar');
    const desafio = await this.servico.atualizar(requisicao.id_desafio ?? '', this.converterDados(requisicao.dados ?? {}));
    if (desafio) await this.registrarAuditoria('desafio_atualizado', desafio.lcr_des_id_desafio, idUsuario, metadados);
    return { operacao_aceita: Boolean(desafio), mensagem_resultado: desafio ? 'Desafio atualizado e devolvido a rascunho.' : 'Desafio não encontrado ou arquivado.', desafio: desafio ? this.mapearGestao(desafio) : {} };
  }

  @GrpcMethod('ServicoDesafios', 'AlterarStatusDesafio')
  async alterarStatusDesafio(requisicao: { id_desafio?: string; status_desafio?: string }, metadados: Metadata) {
    const idUsuario = await this.obterUsuario(metadados, 'gamificacao:administrar');
    const status = requisicao.status_desafio ?? 'rascunho';
    const desafio = await this.servico.alterarStatus(requisicao.id_desafio ?? '', status);
    if (desafio) await this.registrarAuditoria(`desafio_${status}`, desafio.lcr_des_id_desafio, idUsuario, metadados);
    const mensagem = !desafio ? 'Desafio não encontrado.'
      : status === 'publicado' ? 'Desafio publicado.'
        : status === 'arquivado' ? 'Desafio arquivado; participações preservadas.' : 'Desafio devolvido a rascunho.';
    return { operacao_aceita: Boolean(desafio), mensagem_resultado: mensagem, desafio: desafio ? this.mapearGestao(desafio) : {} };
  }

  @GrpcMethod('ServicoDesafios', 'ParticiparDesafio')
  async participarDesafio(requisicao: { id_desafio?: string }, metadados: Metadata): Promise<{ participacao_aceita: boolean; desafio: Partial<DesafioGrpc>; mensagem_resultado: string }> {
    const idUsuario = await this.obterUsuario(metadados, ['gamificacao:ler', 'gamificacao:participar']);
    await this.protegerMutacao(idUsuario, 'participar-desafio', 10);
    const desafio = await this.servico.participar(idUsuario, requisicao.id_desafio ?? '', this.obterCorrelacao(metadados));
    return desafio
      ? { participacao_aceita: true, desafio: this.mapearDesafio(desafio), mensagem_resultado: 'Participacao registrada.' }
      : { participacao_aceita: false, desafio: {}, mensagem_resultado: 'Desafio indisponivel.' };
  }

  @GrpcMethod('ServicoDesafios', 'RegistrarAcaoSustentavel')
  async registrarAcaoSustentavel(requisicao: { id_desafio?: string; tipo_acao?: string; descricao_acao?: string }, metadados: Metadata) {
    const idUsuario = await this.obterUsuario(metadados, ['gamificacao:ler', 'gamificacao:participar']);
    await this.protegerMutacao(idUsuario, 'registrar-acao', 20);
    const resultado = await this.servico.registrarAcao(idUsuario, {
      idDesafio: requisicao.id_desafio ?? '',
      tipoAcao: requisicao.tipo_acao ?? '',
      descricaoAcao: requisicao.descricao_acao ?? '',
    }, this.obterCorrelacao(metadados));
    return resultado
      ? { acao_aceita: true, quantidade_pontos: resultado.quantidadePontos, quantidade_progresso: resultado.quantidadeProgresso, desafio_concluido: resultado.desafioConcluido, mensagem_resultado: resultado.desafioConcluido ? 'Desafio concluido.' : 'Acao registrada.' }
      : { acao_aceita: false, quantidade_pontos: 0, quantidade_progresso: 0, desafio_concluido: false, mensagem_resultado: 'Acao ou participacao invalida.' };
  }

  private async obterIdentidade(metadados: Metadata) {
    const valor = metadados.get('authorization')[0];
    const autorizacao = Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
    return this.autenticacao.obterIdentidadeAtual(autorizacao);
  }

  private async obterUsuario(metadados: Metadata, permissoes: string | readonly string[]) {
    const identidade = await this.obterIdentidade(metadados);
    for (const permissao of typeof permissoes === 'string' ? [permissoes] : permissoes) {
      this.autorizacao.exigirPermissao(identidade, permissao);
    }
    const idUsuario = await this.usuarios.obterIdInterno(identidade.idExterno);
    if (!idUsuario) throw new ServiceUnavailableException('Usuário autenticado sem registro interno');
    return idUsuario;
  }

  private async protegerMutacao(idUsuario: string, operacao: string, limite: number) {
    const resultado = await this.rateLimit.permitir(`lcr:rate:${operacao}:${idUsuario}`, limite, 60);
    if (!resultado.disponivel) throw new ServiceUnavailableException('Protecao contra abuso indisponivel');
    if (!resultado.permitido) throw new RpcException({ code: 8, message: 'Limite de operacoes excedido' });
  }

  private converterDados(dados: RequisicaoDadosDesafio): DadosDesafio {
    return {
      nomeDesafio: dados.nome_desafio ?? '',
      descricaoDesafio: dados.descricao_desafio ?? '',
      tipoAcao: dados.tipo_acao ?? '',
      metaQuantidade: dados.meta_quantidade ?? 0,
      quantidadePontos: dados.quantidade_pontos ?? 0,
      dataInicio: dados.data_inicio ? new Date(dados.data_inicio) : new Date(Number.NaN),
      dataFim: dados.data_fim?.trim() ? new Date(dados.data_fim) : null,
      periodicidade: (dados.periodicidade ?? 'unica') as DadosDesafio['periodicidade'],
      criterios: (dados.criterios ?? []).map(criterio => ({
        tipo: (criterio.tipo ?? '') as CriterioDesafio['tipo'],
        meta: criterio.meta ?? 0,
        categoria: criterio.categoria,
        tema: criterio.tema,
        categorias: criterio.categorias ?? [],
      })),
    };
  }

  private mapearDesafio(desafio: ResumoDesafio): DesafioGrpc {
    return {
      id_desafio: desafio.idDesafio,
      nome_desafio: desafio.nomeDesafio,
      descricao_desafio: desafio.descricaoDesafio,
      tipo_acao: desafio.tipoAcao,
      meta_quantidade: desafio.metaQuantidade,
      quantidade_pontos: desafio.quantidadePontos,
      status_desafio: desafio.statusDesafio,
      quantidade_progresso: desafio.quantidadeProgresso,
      status_participacao: desafio.statusParticipacao,
      periodicidade: desafio.periodicidade,
      periodo_chave: desafio.periodoChave,
      criterios: desafio.criterios.map(criterio => this.mapearCriterio(criterio)),
      progresso_criterios: desafio.progressoCriterios.map(progresso => ({
        criterio: this.mapearCriterio(progresso),
        progresso: progresso.progresso,
        concluido: progresso.concluido,
      })),
      data_fim_periodo: desafio.dataFimPeriodo.toISOString(),
    };
  }

  private mapearGestao(desafio: any) {
    return {
      id_desafio: desafio.lcr_des_id_desafio,
      nome_desafio: desafio.lcr_des_nome_desafio,
      descricao_desafio: desafio.lcr_des_descricao_desafio,
      tipo_acao: desafio.lcr_des_tipo_acao,
      meta_quantidade: desafio.lcr_des_meta_quantidade,
      quantidade_pontos: desafio.lcr_des_quantidade_pontos,
      status_desafio: desafio.lcr_des_status_desafio,
      data_inicio: desafio.lcr_des_data_inicio instanceof Date ? desafio.lcr_des_data_inicio.toISOString() : String(desafio.lcr_des_data_inicio ?? ''),
      data_fim: desafio.lcr_des_data_fim instanceof Date ? desafio.lcr_des_data_fim.toISOString() : String(desafio.lcr_des_data_fim ?? ''),
      periodicidade: desafio.lcr_des_periodicidade ?? 'unica',
      criterios: (desafio.lcr_des_criterios ?? []).map((criterio: CriterioDesafio) => this.mapearCriterio(criterio)),
    };
  }

  private mapearCriterio(criterio: CriterioDesafio) {
    return {
      tipo: criterio.tipo,
      meta: criterio.meta,
      categoria: criterio.categoria ?? '',
      tema: criterio.tema ?? '',
      categorias: criterio.categorias ?? [],
    };
  }

  private registrarAuditoria(tipoEvento: string, idRecurso: string, idUsuario: string, metadados: Metadata) {
    return this.auditoria.registrar({ idUsuario, tipoEvento, recursoEvento: 'desafio', idRecurso, idCorrelacao: this.obterCorrelacao(metadados), detalhesEvento: { recurso: 'desafio' } });
  }

  private obterCorrelacao(metadados: Metadata): string {
    const valor = metadados.get('x-id-correlacao')[0];
    return typeof valor === 'string' && valor.trim() ? valor.slice(0, 120) : randomUUID();
  }
}
