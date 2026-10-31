import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { ServicoGamificacao } from '../gamificacao/gamificacao.servico.js';
import { ServicoUsuarios } from '../usuarios/usuarios.servico.js';
import { ServicoDesafios } from '../desafios/desafios.servico.js';
import { DadosQuestao, RepositorioQuestionarios, StatusQuestao } from './questionarios.repositorio.js';

const statusValidos = new Set<StatusQuestao>(['rascunho', 'publicada', 'arquivada']);
const INTERVALO_AGENDADOR_MS = 5 * 60 * 1000;

@Injectable()
export class ServicoQuestionarios implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServicoQuestionarios.name);
  private temporizador?: NodeJS.Timeout;
  private processandoAgendamentos = false;

  constructor(
    private readonly repositorio: RepositorioQuestionarios,
    private readonly usuarios: ServicoUsuarios,
    private readonly gamificacao: ServicoGamificacao,
    @Optional() private readonly desafios?: ServicoDesafios,
  ) {}

  onModuleInit(): void {
    void this.processarAgendamentos();
    this.temporizador = setInterval(() => void this.processarAgendamentos(), INTERVALO_AGENDADOR_MS);
    this.temporizador.unref?.();
  }

  onModuleDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  async listar(idExternoUsuario: string, numeroPagina?: number, tamanhoPagina?: number) {
    const idUsuario = await this.usuarios.obterIdInterno(idExternoUsuario);
    if (!idUsuario) return [];
    return this.repositorio.listarPublicadas(idUsuario, numeroPagina, tamanhoPagina);
  }

  listarGestao(filtro: { status?: StatusQuestao | 'todos'; textoPesquisa?: string; numeroPagina?: number; tamanhoPagina?: number }) {
    return this.repositorio.listarGestao(filtro);
  }

  obterGestao(id: string) {
    return this.repositorio.obterGestao(id);
  }

  criar(dados: DadosQuestao) {
    return this.repositorio.criar(validarDados(dados));
  }

  atualizar(id: string, dados: DadosQuestao) {
    return this.repositorio.atualizar(id, validarDados(dados));
  }

  async alterarStatus(id: string, status: string) {
    if (!statusValidos.has(status as StatusQuestao)) throw new BadRequestException('Status de questão inválido');
    if (status === 'publicada') {
      const existente = await this.repositorio.obterGestao(id);
      if (!existente) return null;
      validarAlternativas(existente.alternativas.map(alternativa => ({
        textoAlternativa: alternativa.lcr_alt_texto_alternativa,
        indicaCorreta: alternativa.lcr_alt_indica_correta,
        ordemExibicao: alternativa.lcr_alt_ordem_exibicao,
      })));
    }
    return this.repositorio.alterarStatus(id, status as StatusQuestao);
  }

  async responder(idQuestao: string, idAlternativa: string, idExternoUsuario?: string) {
    if (!idQuestao.trim() || !idAlternativa.trim() || !idExternoUsuario?.trim()) return respostaIndisponivel();
    const idUsuario = await this.usuarios.obterIdInterno(idExternoUsuario);
    if (!idUsuario) return respostaIndisponivel();
    const resposta = await this.repositorio.registrarTentativa(
      { idUsuario, idQuestao, idAlternativa },
      (evento, transacao) => this.gamificacao.concederPontos(idUsuario, evento.quantidadePontos, 'quiz_correto', evento.idAtribuicao, evento.temaQuestao, transacao),
    );
    if (!resposta) return respostaIndisponivel();
    if (resposta.jaRespondida) {
      return {
        tentativaRegistrada: false,
        questaoJaRespondida: true,
        indicaCorreta: false,
        quantidadePontos: 0,
        explicacaoResposta: resposta.explicacaoResposta,
      };
    }
    if (!resposta.registrada) return respostaIndisponivel();
    if (resposta.indicaCorreta && resposta.registrada && this.desafios) {
      try {
        await this.desafios.processarProgresso(idUsuario);
      } catch (erro) {
        this.logger.warn(`Não foi possível atualizar metas após o quiz: ${erro instanceof Error ? erro.name : 'erro'}`);
      }
    }
    return {
      tentativaRegistrada: true,
      questaoJaRespondida: false,
      indicaCorreta: resposta.indicaCorreta,
      quantidadePontos: resposta.quantidadePontos,
      explicacaoResposta: resposta.explicacaoResposta,
    };
  }

  private async processarAgendamentos() {
    if (this.processandoAgendamentos) return;
    this.processandoAgendamentos = true;
    try {
      await this.repositorio.processarAgendamentos();
    } catch (erro) {
      this.logger.warn(`Não foi possível processar os quizzes agendados: ${erro instanceof Error ? erro.name : 'erro'}`);
    } finally {
      this.processandoAgendamentos = false;
    }
  }
}

function respostaIndisponivel() {
  return {
    tentativaRegistrada: false,
    questaoJaRespondida: false,
    indicaCorreta: false,
    quantidadePontos: 0,
    explicacaoResposta: 'Questão ou atribuição indisponível. Cada questão pode ser respondida uma única vez.',
  };
}

function validarDados(dados: DadosQuestao): DadosQuestao {
  const enunciadoQuestao = dados.enunciadoQuestao?.trim();
  const explicacaoQuestao = dados.explicacaoQuestao?.trim();
  const temaQuestao = dados.temaQuestao?.trim().toLocaleLowerCase('pt-BR');
  if (!enunciadoQuestao || enunciadoQuestao.length > 4000) throw new BadRequestException('Enunciado obrigatório, com até 4000 caracteres');
  if (!explicacaoQuestao || explicacaoQuestao.length > 8000) throw new BadRequestException('Explique a resposta, com até 8000 caracteres');
  if (!temaQuestao || temaQuestao.length > 80 || !/^[\p{L}\p{N} _-]+$/u.test(temaQuestao)) throw new BadRequestException('Informe um tema com até 80 caracteres');
  if (!Number.isInteger(dados.quantidadePontos) || dados.quantidadePontos < 10 || dados.quantidadePontos > 50) {
    throw new BadRequestException('O limite superior dos pontos sorteados deve estar entre 10 e 50');
  }
  const alternativas = validarAlternativas(dados.alternativas);
  return { enunciadoQuestao, explicacaoQuestao, quantidadePontos: dados.quantidadePontos, temaQuestao, alternativas };
}

function validarAlternativas(alternativas: DadosQuestao['alternativas']): DadosQuestao['alternativas'] {
  if (!Array.isArray(alternativas) || alternativas.length < 2 || alternativas.length > 6) {
    throw new BadRequestException('A questão precisa ter de 2 a 6 alternativas');
  }
  const normalizadas = alternativas.map((alternativa, indice) => {
    const textoAlternativa = alternativa.textoAlternativa?.trim();
    if (!textoAlternativa || textoAlternativa.length > 1000) throw new BadRequestException('Cada alternativa precisa de texto, com até 1000 caracteres');
    return { textoAlternativa, indicaCorreta: Boolean(alternativa.indicaCorreta), ordemExibicao: indice + 1 };
  });
  const chaves = normalizadas.map(alternativa => alternativa.textoAlternativa.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'));
  if (new Set(chaves).size !== chaves.length) throw new BadRequestException('As alternativas não podem se repetir');
  if (normalizadas.filter(alternativa => alternativa.indicaCorreta).length !== 1) {
    throw new BadRequestException('Marque exatamente uma alternativa correta');
  }
  return normalizadas;
}
