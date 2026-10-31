import { Metadata } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { ServicoAutenticacao } from '../autenticacao/autenticacao.servico.js';
import { ServicoAutorizacao } from '../autorizacao/autorizacao.servico.js';
import { ServicoAuditoria } from '../auditoria/auditoria.servico.js';
import { ServicoUsuarios } from '../usuarios/usuarios.servico.js';
import { DadosQuestao, StatusQuestao } from './questionarios.repositorio.js';
import { ServicoQuestionarios } from './questionarios.servico.js';

type DadosQuestaoGrpc = {
  enunciado_questao?: string;
  explicacao_questao?: string;
  quantidade_pontos?: number;
  tema_questao?: string;
  alternativas?: Array<{ texto_alternativa?: string; indica_correta?: boolean; ordem_exibicao?: number }>;
};
interface RespostaListarQuestoes {
  questoes: Array<{
    id_questao: string;
    enunciado_questao: string;
    quantidade_pontos: number;
    tema_questao: string;
    data_expiracao: string;
    alternativas: Array<{ id_alternativa: string; texto_alternativa: string; ordem_exibicao: number }>;
  }>;
}

@Controller()
export class ControladorGrpcQuestionarios {
  constructor(
    private readonly servico: ServicoQuestionarios,
    private readonly autenticacao: ServicoAutenticacao,
    private readonly autorizacao: ServicoAutorizacao,
    private readonly usuarios: ServicoUsuarios,
    private readonly auditoria: ServicoAuditoria,
  ) {}

  @GrpcMethod('ServicoQuestionarios', 'ListarQuestoes')
  async listarQuestoes(requisicao: { numero_pagina?: number; tamanho_pagina?: number }, metadados: Metadata): Promise<RespostaListarQuestoes> {
    const identidade = await this.obterIdentidade(metadados);
    this.autorizacao.exigirPermissao(identidade, 'questionarios:responder');
    const questoes = await this.servico.listar(identidade.idExterno, requisicao.numero_pagina, requisicao.tamanho_pagina);
    return {
      questoes: questoes.map(({ questao, alternativas }) => ({
        id_questao: questao.lcr_que_id_questao,
        enunciado_questao: questao.lcr_que_enunciado_questao,
        quantidade_pontos: questao.lcr_que_quantidade_pontos,
        tema_questao: questao.lcr_que_tema_questao,
        data_expiracao: new Date(questao.lcr_que_data_expiracao).toISOString(),
        // O RPC público não recebe gabarito nem explicação; isso só é retornado após o envio da resposta.
        alternativas: alternativas.map(alternativa => ({
          id_alternativa: alternativa.lcr_alt_id_alternativa,
          texto_alternativa: alternativa.lcr_alt_texto_alternativa,
          ordem_exibicao: alternativa.lcr_alt_ordem_exibicao,
        })),
      })),
    };
  }

  @GrpcMethod('ServicoQuestionarios', 'ListarQuestoesGestao')
  async listarQuestoesGestao(requisicao: { texto_pesquisa?: string; status_questao?: string; numero_pagina?: number; tamanho_pagina?: number }, metadados: Metadata) {
    await this.obterUsuario(metadados, 'questionarios:administrar');
    const resultado = await this.servico.listarGestao({
      textoPesquisa: requisicao.texto_pesquisa,
      status: requisicao.status_questao as StatusQuestao | 'todos' | undefined,
      numeroPagina: requisicao.numero_pagina,
      tamanhoPagina: requisicao.tamanho_pagina,
    });
    return {
      questoes: resultado.questoes.map(item => this.mapearGestao(item)),
      quantidade_total: resultado.quantidadeTotal,
    };
  }

  @GrpcMethod('ServicoQuestionarios', 'CriarQuestao')
  async criarQuestao(requisicao: { dados?: DadosQuestaoGrpc }, metadados: Metadata) {
    const { idUsuario } = await this.obterUsuario(metadados, 'questionarios:administrar');
    const questao = await this.servico.criar(this.converterDados(requisicao.dados ?? {}));
    if (questao) await this.registrarAuditoria('questao_criada', questao.questao.lcr_que_id_questao, idUsuario, metadados);
    return {
      operacao_aceita: Boolean(questao),
      mensagem_resultado: questao ? 'Questão salva como rascunho.' : 'Banco de dados indisponível.',
      questao: questao ? this.mapearGestao(questao) : {},
    };
  }

  @GrpcMethod('ServicoQuestionarios', 'AtualizarQuestao')
  async atualizarQuestao(requisicao: { id_questao?: string; dados?: DadosQuestaoGrpc }, metadados: Metadata) {
    const { idUsuario } = await this.obterUsuario(metadados, 'questionarios:administrar');
    const questao = await this.servico.atualizar(requisicao.id_questao ?? '', this.converterDados(requisicao.dados ?? {}));
    if (questao) await this.registrarAuditoria('questao_atualizada', questao.questao.lcr_que_id_questao, idUsuario, metadados);
    const mensagem = !questao ? 'Questão não encontrada ou arquivada.'
      : questao.novaVersao ? 'Questão respondida/publicada preservada no histórico; uma nova versão foi criada como rascunho.'
        : 'Questão atualizada e devolvida a rascunho.';
    return { operacao_aceita: Boolean(questao), mensagem_resultado: mensagem, questao: questao ? this.mapearGestao(questao) : {} };
  }

  @GrpcMethod('ServicoQuestionarios', 'AlterarStatusQuestao')
  async alterarStatusQuestao(requisicao: { id_questao?: string; status_questao?: string }, metadados: Metadata) {
    const { idUsuario } = await this.obterUsuario(metadados, 'questionarios:administrar');
    const status = requisicao.status_questao ?? 'rascunho';
    const questao = await this.servico.alterarStatus(requisicao.id_questao ?? '', status);
    if (questao) await this.registrarAuditoria(`questao_${status}`, questao.questao.lcr_que_id_questao, idUsuario, metadados);
    const mensagem = !questao ? 'Questão não encontrada.'
      : status === 'publicada' ? 'Questão publicada.'
        : status === 'arquivada' ? 'Questão arquivada; histórico preservado.' : 'Questão devolvida a rascunho.';
    return { operacao_aceita: Boolean(questao), mensagem_resultado: mensagem, questao: questao ? this.mapearGestao(questao) : {} };
  }

  @GrpcMethod('ServicoQuestionarios', 'EnviarRespostaQuestionario')
  async enviarRespostaQuestionario(requisicao: { id_questao?: string; id_alternativa?: string }, metadados: Metadata) {
    const identidade = await this.obterIdentidade(metadados);
    this.autorizacao.exigirPermissao(identidade, 'questionarios:responder');
    const resposta = await this.servico.responder(requisicao.id_questao ?? '', requisicao.id_alternativa ?? '', identidade.idExterno);
    return {
      tentativa_registrada: resposta.tentativaRegistrada,
      questao_ja_respondida: resposta.questaoJaRespondida,
      indica_correta: resposta.indicaCorreta,
      quantidade_pontos: resposta.quantidadePontos,
      explicacao_resposta: resposta.explicacaoResposta,
    };
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

  private converterDados(dados: DadosQuestaoGrpc): DadosQuestao {
    return {
      enunciadoQuestao: dados.enunciado_questao ?? '',
      explicacaoQuestao: dados.explicacao_questao ?? '',
      quantidadePontos: dados.quantidade_pontos ?? 0,
      temaQuestao: dados.tema_questao ?? '',
      alternativas: (dados.alternativas ?? []).map((alternativa, indice) => ({
        textoAlternativa: alternativa.texto_alternativa ?? '',
        indicaCorreta: alternativa.indica_correta ?? false,
        ordemExibicao: alternativa.ordem_exibicao ?? indice + 1,
      })),
    };
  }

  private mapearGestao(item: { questao: any; alternativas: any[] }) {
    return {
      id_questao: item.questao.lcr_que_id_questao,
      enunciado_questao: item.questao.lcr_que_enunciado_questao,
      explicacao_questao: item.questao.lcr_que_explicacao_questao,
      quantidade_pontos: item.questao.lcr_que_quantidade_pontos,
      tema_questao: item.questao.lcr_que_tema_questao,
      status_questao: item.questao.lcr_que_status_questao,
      data_atualizacao: item.questao.lcr_que_data_atualizacao instanceof Date ? item.questao.lcr_que_data_atualizacao.toISOString() : String(item.questao.lcr_que_data_atualizacao ?? ''),
      alternativas: item.alternativas.map(alternativa => ({
        id_alternativa: alternativa.lcr_alt_id_alternativa,
        texto_alternativa: alternativa.lcr_alt_texto_alternativa,
        indica_correta: alternativa.lcr_alt_indica_correta,
        ordem_exibicao: alternativa.lcr_alt_ordem_exibicao,
      })),
    };
  }

  private registrarAuditoria(tipoEvento: string, idRecurso: string, idUsuario: string, metadados: Metadata) {
    const valor = metadados.get('x-id-correlacao')[0];
    const idCorrelacao = typeof valor === 'string' && valor.trim() ? valor.slice(0, 120) : randomUUID();
    return this.auditoria.registrar({
      idUsuario,
      tipoEvento,
      recursoEvento: 'questao',
      idRecurso,
      idCorrelacao,
      detalhesEvento: { recurso: 'questao' },
    });
  }
}
