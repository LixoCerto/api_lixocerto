import { BadRequestException, Injectable } from '@nestjs/common';
import { ServicoGamificacao } from '../gamificacao/gamificacao.servico.js';
import { ServicoUsuarios } from '../usuarios/usuarios.servico.js';
import { DadosQuestao, RepositorioQuestionarios, StatusQuestao } from './questionarios.repositorio.js';

const statusValidos = new Set<StatusQuestao>(['rascunho', 'publicada', 'arquivada']);

@Injectable()
export class ServicoQuestionarios {
  constructor(
    private readonly repositorio: RepositorioQuestionarios,
    private readonly usuarios: ServicoUsuarios,
    private readonly gamificacao: ServicoGamificacao,
  ) {}

  listar(numeroPagina?: number, tamanhoPagina?: number) {
    return this.repositorio.listarPublicadas(numeroPagina, tamanhoPagina);
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
    if (!idQuestao.trim() || !idAlternativa.trim()) {
      return { indicaCorreta: false, quantidadePontos: 0, explicacaoResposta: 'Questao ou alternativa indisponivel.' };
    }
    const resposta = await this.repositorio.obterResposta(idQuestao, idAlternativa);
    if (!resposta) {
      return { indicaCorreta: false, quantidadePontos: 0, explicacaoResposta: 'Questao ou alternativa indisponivel.' };
    }

    const indicaCorreta = resposta.alternativa.lcr_alt_indica_correta;
    let quantidadePontos = indicaCorreta ? resposta.questao.lcr_que_quantidade_pontos : 0;
    let explicacaoResposta = resposta.questao.lcr_que_explicacao_questao;
    const idUsuario = idExternoUsuario ? await this.usuarios.obterIdInterno(idExternoUsuario) : null;
    if (idUsuario) {
      const tentativaRegistrada = await this.repositorio.registrarTentativa({ idUsuario, idQuestao, idAlternativa, indicaCorreta, quantidadePontos });
      if (!tentativaRegistrada && indicaCorreta) {
        quantidadePontos = 0;
        explicacaoResposta = 'Você já recebeu a recompensa desta questão.';
      }
      if (tentativaRegistrada && indicaCorreta && quantidadePontos > 0) await this.gamificacao.concederPontos(idUsuario, quantidadePontos);
    }
    return { indicaCorreta, quantidadePontos, explicacaoResposta };
  }
}

function validarDados(dados: DadosQuestao): DadosQuestao {
  const enunciadoQuestao = dados.enunciadoQuestao?.trim();
  const explicacaoQuestao = dados.explicacaoQuestao?.trim();
  if (!enunciadoQuestao || enunciadoQuestao.length > 4000) throw new BadRequestException('Enunciado obrigatório, com até 4000 caracteres');
  if (!explicacaoQuestao || explicacaoQuestao.length > 8000) throw new BadRequestException('Explique a resposta, com até 8000 caracteres');
  if (!Number.isInteger(dados.quantidadePontos) || dados.quantidadePontos < 0 || dados.quantidadePontos > 10000) {
    throw new BadRequestException('A pontuação deve ser um número inteiro entre 0 e 10000');
  }
  const alternativas = validarAlternativas(dados.alternativas);
  return { enunciadoQuestao, explicacaoQuestao, quantidadePontos: dados.quantidadePontos, alternativas };
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
