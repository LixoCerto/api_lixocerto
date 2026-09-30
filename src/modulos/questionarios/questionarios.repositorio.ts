import { Inject, Injectable } from '@nestjs/common';
import { Op, QueryTypes, Sequelize, Transaction } from 'sequelize';
import { randomInt } from 'node:crypto';
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
  temaQuestao: string;
  alternativas: DadosAlternativaQuestao[];
}
export interface FiltroGestaoQuestoes {
  status?: StatusQuestao | 'todos';
  textoPesquisa?: string;
  numeroPagina?: number;
  tamanhoPagina?: number;
}
export interface ResultadoTentativa {
  registrada: boolean;
  jaRespondida?: boolean;
  indicaCorreta: boolean;
  quantidadePontos: number;
  explicacaoResposta: string;
  idAtribuicao?: string;
  temaQuestao?: string;
}

@Injectable()
export class RepositorioQuestionarios {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async listarPublicadas(idUsuario: string, _numeroPagina = 1, _tamanhoPagina = 20) {
    if (!this.banco || !idUsuario) return [];
    const atribuicoes = await this.banco.query<{
      id_questao: string; quantidade_pontos: number; tema: string; data_expiracao: Date;
    }>(
      `SELECT lcr_qat_id_questao AS id_questao,
              lcr_qat_pontos_sorteados AS quantidade_pontos,
              lcr_qat_tema AS tema,
              lcr_qat_data_expiracao AS data_expiracao
       FROM lcr_quiz_atribuicoes
       WHERE lcr_qat_id_usuario = :idUsuario
         AND lcr_qat_status = 'disponivel'
         AND lcr_qat_data_disponibilizacao <= CURRENT_TIMESTAMP
         AND lcr_qat_data_expiracao > CURRENT_TIMESTAMP
       ORDER BY lcr_qat_data_disponibilizacao ASC
       LIMIT 1`,
      { replacements: { idUsuario }, type: QueryTypes.SELECT },
    );
    if (!atribuicoes.length) return [];
    const atribuicao = atribuicoes[0];
    if (!atribuicao) return [];
    const questao = await ModeloQuestao.findOne({
      where: { lcr_que_id_questao: atribuicao.id_questao, lcr_que_status_questao: 'publicada' },
    });
    if (!questao) return [];
    const alternativas = await ModeloAlternativa.findAll({
      where: { lcr_alt_id_questao: questao.lcr_que_id_questao },
      attributes: ['lcr_alt_id_alternativa', 'lcr_alt_texto_alternativa', 'lcr_alt_ordem_exibicao'],
      order: [['lcr_alt_ordem_exibicao', 'ASC']],
    });
    return [{
      questao: Object.assign(questao, {
        lcr_que_quantidade_pontos: Number(atribuicao.quantidade_pontos),
        lcr_que_tema_questao: atribuicao.tema,
        lcr_que_data_expiracao: atribuicao.data_expiracao,
      }),
      alternativas,
    }];
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
      const agora = new Date();
      const questao = await ModeloQuestao.create({
        lcr_que_enunciado_questao: dados.enunciadoQuestao,
        lcr_que_explicacao_questao: dados.explicacaoQuestao,
        lcr_que_quantidade_pontos: dados.quantidadePontos,
        lcr_que_tema_questao: dados.temaQuestao,
        lcr_que_status_questao: 'rascunho',
        lcr_que_data_criacao: agora,
        lcr_que_data_atualizacao: agora,
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
        await questao.update({ lcr_que_status_questao: 'arquivada', lcr_que_data_atualizacao: new Date() }, { transaction: transacao });
        const novaQuestao = await ModeloQuestao.create({
          lcr_que_enunciado_questao: dados.enunciadoQuestao,
          lcr_que_explicacao_questao: dados.explicacaoQuestao,
          lcr_que_quantidade_pontos: dados.quantidadePontos,
          lcr_que_tema_questao: dados.temaQuestao,
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
        lcr_que_tema_questao: dados.temaQuestao,
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

  async registrarTentativa(
    dados: { idUsuario: string; idQuestao: string; idAlternativa: string },
    aoResponderCorretamente?: (evento: { idAtribuicao: string; temaQuestao: string; quantidadePontos: number }, transaction: Transaction) => Promise<unknown>,
  ): Promise<ResultadoTentativa | null> {
    if (!this.banco) return null;
    const transacao = await this.banco.transaction();
    try {
      const atribuicoes = await this.banco.query<{
        id_atribuicao: string; pontos_sorteados: number; tema: string;
      }>(
        `SELECT lcr_qat_id_atribuicao AS id_atribuicao,
                lcr_qat_pontos_sorteados AS pontos_sorteados,
                lcr_qat_tema AS tema
         FROM lcr_quiz_atribuicoes
         WHERE lcr_qat_id_usuario = :idUsuario
           AND lcr_qat_id_questao = :idQuestao
           AND lcr_qat_status = 'disponivel'
           AND lcr_qat_data_disponibilizacao <= CURRENT_TIMESTAMP
           AND lcr_qat_data_expiracao > CURRENT_TIMESTAMP
         FOR UPDATE`,
        { replacements: dados, type: QueryTypes.SELECT, transaction: transacao },
      );
      const atribuicao = atribuicoes[0];
      if (!atribuicao) {
        await transacao.rollback();
        return null;
      }

      const anterior = await ModeloTentativaQuestionario.findOne({
        where: { lcr_tqu_id_usuario: dados.idUsuario, lcr_tqu_id_questao: dados.idQuestao },
        attributes: ['lcr_tqu_id_tentativa_questionario'],
        transaction: transacao,
        lock: transacao.LOCK.UPDATE,
      });
      if (anterior) {
        await this.banco.query(
          `UPDATE lcr_quiz_atribuicoes
           SET lcr_qat_status = 'respondida', lcr_qat_data_resposta = CURRENT_TIMESTAMP
           WHERE lcr_qat_id_atribuicao = :idAtribuicao`,
          { replacements: { idAtribuicao: atribuicao.id_atribuicao }, transaction: transacao },
        );
        await transacao.commit();
        return { registrada: false, jaRespondida: true, indicaCorreta: false, quantidadePontos: 0, explicacaoResposta: 'Você já respondeu esta questão; novas tentativas não são permitidas.' };
      }

      const questao = await ModeloQuestao.findOne({
        where: { lcr_que_id_questao: dados.idQuestao, lcr_que_status_questao: 'publicada' },
        transaction: transacao,
        lock: transacao.LOCK.UPDATE,
      });
      const alternativa = await ModeloAlternativa.findOne({
        where: { lcr_alt_id_questao: dados.idQuestao, lcr_alt_id_alternativa: dados.idAlternativa },
        transaction: transacao,
      });
      if (!questao || !alternativa) {
        await transacao.rollback();
        return null;
      }
      const indicaCorreta = Boolean(alternativa.lcr_alt_indica_correta);
      const quantidadePontos = indicaCorreta ? Number(atribuicao.pontos_sorteados) : 0;
      await ModeloTentativaQuestionario.create({
        lcr_tqu_id_usuario: dados.idUsuario,
        lcr_tqu_id_questao: dados.idQuestao,
        lcr_tqu_id_alternativa: dados.idAlternativa,
        lcr_tqu_indica_correta: indicaCorreta,
        lcr_tqu_quantidade_pontos: quantidadePontos,
      }, { transaction: transacao });
      await this.banco.query(
        `UPDATE lcr_quiz_atribuicoes
         SET lcr_qat_status = 'respondida', lcr_qat_indica_correta = :indicaCorreta,
             lcr_qat_data_resposta = CURRENT_TIMESTAMP
         WHERE lcr_qat_id_atribuicao = :idAtribuicao`,
        { replacements: { indicaCorreta, idAtribuicao: atribuicao.id_atribuicao }, transaction: transacao },
      );
      const intervaloHoras = randomInt(24, 73);
      await this.banco.query(
        `UPDATE lcr_progresso_usuarios
         SET lcr_prg_proximo_quiz_em = CURRENT_TIMESTAMP + (:intervaloHoras * INTERVAL '1 hour'),
             lcr_prg_ultimo_tema_quiz = :tema,
             lcr_prg_data_atualizacao = CURRENT_TIMESTAMP
         WHERE lcr_prg_id_usuario = :idUsuario`,
        { replacements: { intervaloHoras, tema: atribuicao.tema, idUsuario: dados.idUsuario }, transaction: transacao },
      );
      if (indicaCorreta) {
        await aoResponderCorretamente?.({ idAtribuicao: atribuicao.id_atribuicao, temaQuestao: atribuicao.tema, quantidadePontos }, transacao);
      }
      await transacao.commit();
      return {
        registrada: true,
        indicaCorreta,
        quantidadePontos,
        explicacaoResposta: questao.lcr_que_explicacao_questao,
        idAtribuicao: atribuicao.id_atribuicao,
        temaQuestao: atribuicao.tema,
      };
    } catch (erro) {
      await transacao.rollback();
      throw erro;
    }
  }

  async processarAgendamentos(): Promise<void> {
    if (!this.banco) return;
    await this.banco.transaction(async transaction => {
      await this.banco!.query(
        `INSERT INTO lcr_progresso_usuarios (lcr_prg_id_usuario, lcr_prg_proximo_quiz_em)
         SELECT u.lcr_usr_id_usuario,
                CURRENT_TIMESTAMP + ((24 + floor(random() * 49)) * INTERVAL '1 hour')
         FROM lcr_usuarios u
         WHERE u.lcr_usr_status_usuario = 'ativo'
         ON CONFLICT (lcr_prg_id_usuario) DO NOTHING`,
        { transaction },
      );

      const expiradas = await this.banco!.query<{ id_usuario: string }>(
        `UPDATE lcr_quiz_atribuicoes
         SET lcr_qat_status = 'expirada'
         WHERE lcr_qat_status = 'disponivel'
           AND lcr_qat_data_expiracao <= CURRENT_TIMESTAMP
         RETURNING lcr_qat_id_usuario AS id_usuario`,
        { type: QueryTypes.SELECT, transaction },
      );
      for (const { id_usuario: idUsuario } of expiradas) {
        const intervaloHoras = randomInt(24, 73);
        await this.banco!.query(
          `UPDATE lcr_progresso_usuarios
           SET lcr_prg_proximo_quiz_em = COALESCE(lcr_prg_proximo_quiz_em, CURRENT_TIMESTAMP + (:intervaloHoras * INTERVAL '1 hour'))
           WHERE lcr_prg_id_usuario = :idUsuario`,
          { replacements: { intervaloHoras, idUsuario }, transaction },
        );
      }

      const prontos = await this.banco!.query<{ id_usuario: string; ultimo_tema: string | null }>(
        `SELECT p.lcr_prg_id_usuario AS id_usuario,
                p.lcr_prg_ultimo_tema_quiz AS ultimo_tema
         FROM lcr_progresso_usuarios p
         JOIN lcr_usuarios u ON u.lcr_usr_id_usuario = p.lcr_prg_id_usuario
         WHERE u.lcr_usr_status_usuario = 'ativo'
           AND p.lcr_prg_proximo_quiz_em <= CURRENT_TIMESTAMP
           AND NOT EXISTS (
             SELECT 1 FROM lcr_quiz_atribuicoes a
             WHERE a.lcr_qat_id_usuario = p.lcr_prg_id_usuario
               AND a.lcr_qat_status = 'disponivel'
           )
         ORDER BY p.lcr_prg_proximo_quiz_em
         LIMIT 200
         FOR UPDATE OF p SKIP LOCKED`,
        { type: QueryTypes.SELECT, transaction },
      );

      for (const { id_usuario: idUsuario, ultimo_tema: ultimoTema } of prontos) {
        const escolha = await this.escolherQuestaoAleatoria(idUsuario, ultimoTema, transaction);
        if (!escolha) {
          await this.banco!.query(
            `UPDATE lcr_progresso_usuarios SET lcr_prg_proximo_quiz_em = CURRENT_TIMESTAMP + INTERVAL '48 hours' WHERE lcr_prg_id_usuario = :idUsuario`,
            { replacements: { idUsuario }, transaction },
          );
          continue;
        }
        const limite = Math.max(10, Math.min(50, Number(escolha.pontosMaximos) || 50));
        const pontos = limite <= 10 ? 10 : randomInt(10, limite + 1);
        await this.banco!.query(
          `INSERT INTO lcr_quiz_atribuicoes
             (lcr_qat_id_usuario, lcr_qat_id_questao, lcr_qat_tema, lcr_qat_pontos_sorteados,
              lcr_qat_status, lcr_qat_data_disponibilizacao, lcr_qat_data_expiracao)
           VALUES (:idUsuario, :idQuestao, :tema, :pontos, 'disponivel', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '48 hours')
           ON CONFLICT (lcr_qat_id_usuario, lcr_qat_id_questao) DO NOTHING`,
          { replacements: { idUsuario, idQuestao: escolha.idQuestao, tema: escolha.tema, pontos }, transaction },
        );
        await this.banco!.query(
          `UPDATE lcr_progresso_usuarios SET lcr_prg_proximo_quiz_em = NULL WHERE lcr_prg_id_usuario = :idUsuario`,
          { replacements: { idUsuario }, transaction },
        );
      }
    });
  }

  private async escolherQuestaoAleatoria(idUsuario: string, ultimoTema: string | null, transaction: Transaction) {
    const escolher = async (excluirTema: boolean) => {
      const condicaoTema = excluirTema && ultimoTema ? 'AND q.lcr_que_tema_questao <> :ultimoTema' : '';
      const resultado = await this.banco!.query<{ idQuestao: string; tema: string; pontosMaximos: number }>(
        `SELECT q.lcr_que_id_questao AS "idQuestao",
                q.lcr_que_tema_questao AS tema,
                q.lcr_que_quantidade_pontos AS "pontosMaximos"
         FROM lcr_questoes q
         WHERE q.lcr_que_status_questao = 'publicada'
           ${condicaoTema}
           AND NOT EXISTS (
             SELECT 1 FROM lcr_quiz_atribuicoes a
             WHERE a.lcr_qat_id_usuario = :idUsuario AND a.lcr_qat_id_questao = q.lcr_que_id_questao
           )
           AND NOT EXISTS (
             SELECT 1 FROM lcr_tentativas_questionario t
             WHERE t.lcr_tqu_id_usuario = :idUsuario AND t.lcr_tqu_id_questao = q.lcr_que_id_questao
           )
         ORDER BY random()
         LIMIT 1`,
        { replacements: { idUsuario, ultimoTema }, type: QueryTypes.SELECT, transaction },
      );
      return resultado[0];
    };
    return await escolher(true) ?? escolher(false);
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
