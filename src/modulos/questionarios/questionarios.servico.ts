import { Injectable } from '@nestjs/common';
import { ServicoGamificacao } from '../gamificacao/gamificacao.servico.js';
import { ServicoUsuarios } from '../usuarios/usuarios.servico.js';
import { RepositorioQuestionarios } from './questionarios.repositorio.js';

@Injectable()
export class ServicoQuestionarios {
  constructor(
    private readonly repositorio: RepositorioQuestionarios,
    private readonly usuarios: ServicoUsuarios,
    private readonly gamificacao: ServicoGamificacao,
  ) {}

  async listar(numeroPagina?: number, tamanhoPagina?: number) {
    return this.repositorio.listarPublicadas(numeroPagina, tamanhoPagina);
  }

  async responder(idQuestao: string, idAlternativa: string, idExternoUsuario?: string) {
    const resposta = await this.repositorio.obterResposta(idQuestao, idAlternativa);
    if (!resposta) {
      return {
        indicaCorreta: false,
        quantidadePontos: 0,
        explicacaoResposta: 'Questao ou alternativa indisponivel.',
      };
    }

    const indicaCorreta = resposta.alternativa.lcr_alt_indica_correta;
    const quantidadePontos = indicaCorreta ? resposta.questao.lcr_que_quantidade_pontos : 0;
    const idUsuario = idExternoUsuario ? await this.usuarios.obterIdInterno(idExternoUsuario) : null;
    if (idUsuario) {
      await this.repositorio.registrarTentativa({
        idUsuario,
        idQuestao,
        idAlternativa,
        indicaCorreta,
        quantidadePontos,
      });
      if (indicaCorreta && quantidadePontos > 0) {
        await this.gamificacao.concederPontos(idUsuario, quantidadePontos);
      }
    }

    return {
      indicaCorreta,
      quantidadePontos,
      explicacaoResposta: resposta.questao.lcr_que_explicacao_questao,
    };
  }
}
