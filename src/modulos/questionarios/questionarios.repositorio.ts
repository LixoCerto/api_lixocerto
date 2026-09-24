import { Inject, Injectable } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { ModeloAlternativa } from '../../infraestrutura/banco/modelos/alternativa.modelo.js';
import { ModeloQuestao } from '../../infraestrutura/banco/modelos/questao.modelo.js';
import { ModeloTentativaQuestionario } from '../../infraestrutura/banco/modelos/tentativa_questionario.modelo.js';

@Injectable()
export class RepositorioQuestionarios {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async listarPublicadas(numeroPagina = 1, tamanhoPagina = 20) {
    if (!this.banco) return [];
    const pagina = Math.max(1, numeroPagina);
    const limite = Math.min(100, Math.max(1, tamanhoPagina));
    const questoes = await ModeloQuestao.findAll({
      where: { lcr_que_status_questao: 'publicada' },
      order: [['lcr_que_data_criacao', 'DESC']],
      limit: limite,
      offset: (pagina - 1) * limite,
    });

    return Promise.all(questoes.map(async questao => ({
      questao,
      alternativas: await ModeloAlternativa.findAll({
        where: { lcr_alt_id_questao: questao.lcr_que_id_questao },
        attributes: ['lcr_alt_id_alternativa', 'lcr_alt_texto_alternativa', 'lcr_alt_ordem_exibicao'],
        order: [['lcr_alt_ordem_exibicao', 'ASC']],
      }),
    })));
  }

  async obterResposta(idQuestao: string, idAlternativa: string) {
    if (!this.banco) return null;
    const questao = await ModeloQuestao.findOne({ where: { lcr_que_id_questao: idQuestao, lcr_que_status_questao: 'publicada' } });
    const alternativa = await ModeloAlternativa.findOne({ where: { lcr_alt_id_questao: idQuestao, lcr_alt_id_alternativa: idAlternativa } });
    if (!questao || !alternativa) return null;
    return { questao, alternativa };
  }

  async registrarTentativa(dados: {
    idUsuario: string;
    idQuestao: string;
    idAlternativa: string;
    indicaCorreta: boolean;
    quantidadePontos: number;
  }): Promise<void> {
    if (!this.banco) return;
    await ModeloTentativaQuestionario.create({
      lcr_tqu_id_usuario: dados.idUsuario,
      lcr_tqu_id_questao: dados.idQuestao,
      lcr_tqu_id_alternativa: dados.idAlternativa,
      lcr_tqu_indica_correta: dados.indicaCorreta,
      lcr_tqu_quantidade_pontos: dados.quantidadePontos,
    });
  }
}
