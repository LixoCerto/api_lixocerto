import { Inject, Injectable } from '@nestjs/common';
import { Op, Sequelize, Transaction } from 'sequelize';
import { ModeloAlternativa } from '../../infraestrutura/banco/modelos/alternativa.modelo.js';
import { ModeloQuestao } from '../../infraestrutura/banco/modelos/questao.modelo.js';
import { ModeloTentativaQuestionario } from '../../infraestrutura/banco/modelos/tentativa_questionario.modelo.js';

export type StatusQuestao = 'rascunho' | 'publicada' | 'arquivada';
export interface DadosAlternativaQuestao {
  textoAlternativa: string;
  indicaCorreta: boolean;
  ordemExibicao: number;
}
export interface DadosQuestao {
  enunciadoQuestao: string;
  explicacaoQuestao: string;
  quantidadePontos: number;
  alternativas: DadosAlternativaQuestao[];
}
export interface FiltroGestaoQuestoes {
  status?: StatusQuestao | 'todos';
  textoPesquisa?: string;
  numeroPagina?: number;
  tamanhoPagina?: number;
}

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

  async listarGestao(filtro: FiltroGestaoQuestoes = {}) {
    if (!this.banco) return { questoes: [], quantidadeTotal: 0 };
    const numeroPagina = Math.max(1, filtro.numeroPagina ?? 1);
    const tamanhoPagina = Math.min(100, Math.max(1, filtro.tamanhoPagina ?? 30));
    const where: Record<string, unknown> = {};
    if (filtro.status && filtro.status !== 'todos') where.lcr_que_status_questao = filtro.status;
    const texto = filtro.textoPesquisa?.trim();
    if (texto) where.lcr_que_enunciado_questao = { [Op.iLike]: `%${texto}%` };

    const resultado = await ModeloQuestao.findAndCountAll({
      where,
      order: [['lcr_que_data_atualizacao', 'DESC'], ['lcr_que_data_criacao', 'DESC']],
      limit: tamanhoPagina,
      offset: (numeroPagina - 1) * tamanhoPagina,
    });
    const ids = resultado.rows.map(questao => questao.lcr_que_id_questao);
    const alternativas = ids.length ? await ModeloAlternativa.findAll({
      where: { lcr_alt_id_questao: { [Op.in]: ids } },
      order: [['lcr_alt_ordem_exibicao', 'ASC']],
    }) : [];
    const porQuestao = new Map<string, ModeloAlternativa[]>();
    for (const alternativa of alternativas) {
      const lista = porQuestao.get(alternativa.lcr_alt_id_questao) ?? [];
      lista.push(alternativa);
      porQuestao.set(alternativa.lcr_alt_id_questao, lista);
    }
    return {
      questoes: resultado.rows.map(questao => ({ questao, alternativas: porQuestao.get(questao.lcr_que_id_questao) ?? [] })),
      quantidadeTotal: resultado.count,
    };
  }

  async criar(dados: DadosQuestao) {
    if (!this.banco) return null;
    const transacao = await this.banco.transaction();
    try {
      const questao = await ModeloQuestao.create({
        lcr_que_enunciado_questao: dados.enunciadoQuestao,
        lcr_que_explicacao_questao: dados.explicacaoQuestao,
        lcr_que_quantidade_pontos: dados.quantidadePontos,
        lcr_que_status_questao: 'rascunho',
        lcr_que_data_criacao: new Date(),
        lcr_que_data_atualizacao: new Date(),
      }, { transaction: transacao });
      const alternativas = await this.criarAlternativas(questao.lcr_que_id_questao, dados.alternativas, transacao);
      await transacao.commit();
      return { questao, alternativas, novaVersao: false };
    } catch (erro) {
      await transacao.rollback();
      throw erro;
    }
  }

  async atualizar(id: string, dados: DadosQuestao) {
    if (!this.banco) return null;
    const transacao = await this.banco.transaction();
    try {
      const questao = await ModeloQuestao.findByPk(id, { transaction: transacao, lock: transacao.LOCK.UPDATE });
      if (!questao || questao.lcr_que_status_questao === 'arquivada') {
        await transacao.rollback();
        return null;
      }
      const tentativas = await ModeloTentativaQuestionario.count({ where: { lcr_tqu_id_questao: id }, transaction: transacao });
      if (questao.lcr_que_status_questao === 'publicada' || tentativas > 0) {
        // Publicações e respostas já utilizadas são imutáveis: a edição cria uma nova versão em rascunho.
        await questao.update({ lcr_que_status_questao: 'arquivada', lcr_que_data_atualizacao: new Date() }, { transaction: transacao });
        const novaQuestao = await ModeloQuestao.create({
          lcr_que_enunciado_questao: dados.enunciadoQuestao,
          lcr_que_explicacao_questao: dados.explicacaoQuestao,
          lcr_que_quantidade_pontos: dados.quantidadePontos,
          lcr_que_status_questao: 'rascunho',
          lcr_que_data_criacao: new Date(),
          lcr_que_data_atualizacao: new Date(),
        }, { transaction: transacao });
        const alternativas = await this.criarAlternativas(novaQuestao.lcr_que_id_questao, dados.alternativas, transacao);
        await transacao.commit();
        return { questao: novaQuestao, alternativas, novaVersao: true };
      }

      await questao.update({
        lcr_que_enunciado_questao: dados.enunciadoQuestao,
        lcr_que_explicacao_questao: dados.explicacaoQuestao,
        lcr_que_quantidade_pontos: dados.quantidadePontos,
        lcr_que_status_questao: 'rascunho',
        lcr_que_data_atualizacao: new Date(),
      }, { transaction: transacao });
      await ModeloAlternativa.destroy({ where: { lcr_alt_id_questao: id }, transaction: transacao });
      const alternativas = await this.criarAlternativas(id, dados.alternativas, transacao);
      await transacao.commit();
      return { questao, alternativas, novaVersao: false };
    } catch (erro) {
      await transacao.rollback();
      throw erro;
    }
  }

  async obterGestao(id: string) {
    if (!this.banco) return null;
    const questao = await ModeloQuestao.findByPk(id);
    if (!questao) return null;
    const alternativas = await ModeloAlternativa.findAll({
      where: { lcr_alt_id_questao: id },
      order: [['lcr_alt_ordem_exibicao', 'ASC']],
    });
    return { questao, alternativas };
  }

  async alterarStatus(id: string, status: StatusQuestao) {
    if (!this.banco) return null;
    const questao = await ModeloQuestao.findByPk(id);
    if (!questao) return null;
    await questao.update({ lcr_que_status_questao: status, lcr_que_data_atualizacao: new Date() });
    const alternativas = await ModeloAlternativa.findAll({
      where: { lcr_alt_id_questao: id },
      order: [['lcr_alt_ordem_exibicao', 'ASC']],
    });
    return { questao, alternativas };
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
  }): Promise<boolean> {
    if (!this.banco) return false;
    const transacao = await this.banco.transaction();
    try {
      const questao = await ModeloQuestao.findByPk(dados.idQuestao, {
        transaction: transacao,
        lock: transacao.LOCK.UPDATE,
      });
      if (!questao) {
        await transacao.rollback();
        return false;
      }
      if (dados.indicaCorreta) {
        const acertoAnterior = await ModeloTentativaQuestionario.findOne({
          where: {
            lcr_tqu_id_usuario: dados.idUsuario,
            lcr_tqu_id_questao: dados.idQuestao,
            lcr_tqu_indica_correta: true,
          },
          attributes: ['lcr_tqu_id_tentativa_questionario'],
          transaction: transacao,
        });
        if (acertoAnterior) {
          await transacao.rollback();
          return false;
        }
      }
      await ModeloTentativaQuestionario.create({
        lcr_tqu_id_usuario: dados.idUsuario,
        lcr_tqu_id_questao: dados.idQuestao,
        lcr_tqu_id_alternativa: dados.idAlternativa,
        lcr_tqu_indica_correta: dados.indicaCorreta,
        lcr_tqu_quantidade_pontos: dados.quantidadePontos,
      }, { transaction: transacao });
      await transacao.commit();
      return true;
    } catch (erro) {
      await transacao.rollback();
      throw erro;
    }
  }

  private criarAlternativas(idQuestao: string, dados: DadosAlternativaQuestao[], transaction: Transaction) {
    return ModeloAlternativa.bulkCreate(dados.map(alternativa => ({
      lcr_alt_id_questao: idQuestao,
      lcr_alt_texto_alternativa: alternativa.textoAlternativa,
      lcr_alt_indica_correta: alternativa.indicaCorreta,
      lcr_alt_ordem_exibicao: alternativa.ordemExibicao,
    })), { transaction, returning: true });
  }
}
