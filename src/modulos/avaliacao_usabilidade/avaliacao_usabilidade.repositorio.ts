import { Inject, Injectable } from '@nestjs/common';
import { QueryTypes, Sequelize } from 'sequelize';
import { ModeloRespostaSus } from '../../infraestrutura/banco/modelos/resposta_sus.modelo.js';
import { ModeloSessaoAvaliacao } from '../../infraestrutura/banco/modelos/sessao_avaliacao.modelo.js';

@Injectable()
export class RepositorioAvaliacaoUsabilidade {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async salvar(hashParticipante: string, notasItens: number[], pontuacaoSus: number): Promise<void> {
    if (!this.banco) return;
    const transacao = await this.banco.transaction();
    try {
      const sessao = await ModeloSessaoAvaliacao.create({
        lcr_sea_codigo_participante_hash: hashParticipante,
        lcr_sea_indica_consentimento: true,
        lcr_sea_versao_instrumento: 'SUS-1.0',
        lcr_sea_data_inicio: new Date(),
        lcr_sea_data_conclusao: new Date(),
      }, { transaction: transacao });

      await ModeloRespostaSus.bulkCreate(notasItens.map((nota, indice) => ({
        lcr_rsu_id_sessao_avaliacao: sessao.lcr_sea_id_sessao_avaliacao,
        lcr_rsu_numero_item: indice + 1,
        lcr_rsu_nota_item: nota,
      })), { transaction: transacao });

      await transacao.commit();
    } catch (erro) {
      await transacao.rollback();
      throw erro;
    }
  }

  async obterResultadosAgregados() {
    if (!this.banco) return { quantidadeParticipantes: 0, mediaPontuacaoSus: 0, medianaPontuacaoSus: 0 };

    const linhas = await this.banco.query<{ pontuacao_sus: string | number }>(
      `SELECT
         (SUM(CASE WHEN resposta.lcr_rsu_numero_item % 2 = 1
                   THEN resposta.lcr_rsu_nota_item - 1
                   ELSE 5 - resposta.lcr_rsu_nota_item END) * 2.5) AS pontuacao_sus
       FROM lcr_sessoes_avaliacao sessao
       INNER JOIN lcr_respostas_sus resposta
         ON resposta.lcr_rsu_id_sessao_avaliacao = sessao.lcr_sea_id_sessao_avaliacao
       WHERE sessao.lcr_sea_indica_consentimento = TRUE
       GROUP BY sessao.lcr_sea_id_sessao_avaliacao
       ORDER BY pontuacao_sus ASC`,
      { type: QueryTypes.SELECT },
    );
    const pontuacoes = linhas.map(linha => Number(linha.pontuacao_sus)).filter(Number.isFinite);
    if (!pontuacoes.length) return { quantidadeParticipantes: 0, mediaPontuacaoSus: 0, medianaPontuacaoSus: 0 };
    const soma = pontuacoes.reduce((total, valor) => total + valor, 0);
    const meio = Math.floor(pontuacoes.length / 2);
    const mediana = pontuacoes.length % 2 === 0 ? (pontuacoes[meio - 1]! + pontuacoes[meio]!) / 2 : pontuacoes[meio]!;
    return {
      quantidadeParticipantes: pontuacoes.length,
      mediaPontuacaoSus: Number((soma / pontuacoes.length).toFixed(2)),
      medianaPontuacaoSus: Number(mediana.toFixed(2)),
    };
  }
}
