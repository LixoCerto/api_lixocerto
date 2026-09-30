import { Inject, Injectable } from '@nestjs/common';
import { QueryTypes, Sequelize, Transaction } from 'sequelize';
import { randomUUID } from 'node:crypto';
import { ModeloProgressoUsuario } from '../../infraestrutura/banco/modelos/progresso_usuario.modelo.js';

export type TipoOrigemPontos = 'descarte_validado' | 'quiz_correto' | 'desafio_concluido' | 'ajuste';
export interface SeloUsuario {
  codigo: string;
  nome: string;
  descricao: string;
  pontosMinimos: number;
  icone: string;
  conquistado: boolean;
  dataConquista: string;
}
export interface ResumoPontosOrigem {
  origem: TipoOrigemPontos;
  quantidadePontos: number;
  quantidadeEventos: number;
}
export interface ProgressoGamificacao {
  quantidadePontos: number;
  nivelGamificacao: string;
  sequenciaDias: number;
  quantidadeConquistas: number;
  selos: SeloUsuario[];
  pontosPorOrigem: ResumoPontosOrigem[];
}

@Injectable()
export class RepositorioProgresso {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async obter(idUsuario: string): Promise<ProgressoGamificacao> {
    if (!this.banco) {
      return { quantidadePontos: 0, nivelGamificacao: 'iniciante', sequenciaDias: 0, quantidadeConquistas: 0, selos: [], pontosPorOrigem: [] };
    }
    const [progresso] = await ModeloProgressoUsuario.findOrCreate({
      where: { lcr_prg_id_usuario: idUsuario },
      defaults: {
        lcr_prg_id_usuario: idUsuario,
        lcr_prg_quantidade_pontos: 0,
        lcr_prg_nivel_gamificacao: 'iniciante',
        lcr_prg_sequencia_dias: 0,
        lcr_prg_data_ultima_atividade: null,
      },
    });
    await this.gravarSelosAtingidos(idUsuario, progresso.lcr_prg_quantidade_pontos);
    const [selos, pontosPorOrigem] = await Promise.all([
      this.listarSelos(idUsuario),
      this.resumirPontosPorOrigem(idUsuario),
    ]);
    return {
      quantidadePontos: progresso.lcr_prg_quantidade_pontos,
      nivelGamificacao: progresso.lcr_prg_nivel_gamificacao,
      sequenciaDias: progresso.lcr_prg_sequencia_dias,
      quantidadeConquistas: selos.filter(selo => selo.conquistado).length,
      selos,
      pontosPorOrigem,
    };
  }

  async atualizar(idUsuario: string, dados: { quantidadePontos: number; nivelGamificacao: string }) {
    if (!this.banco) return;
    const [progresso] = await ModeloProgressoUsuario.findOrCreate({
      where: { lcr_prg_id_usuario: idUsuario },
      defaults: {
        lcr_prg_id_usuario: idUsuario,
        lcr_prg_quantidade_pontos: 0,
        lcr_prg_nivel_gamificacao: 'iniciante',
        lcr_prg_sequencia_dias: 0,
        lcr_prg_data_ultima_atividade: null,
      },
    });
    await progresso.update({
      lcr_prg_quantidade_pontos: dados.quantidadePontos,
      lcr_prg_nivel_gamificacao: dados.nivelGamificacao,
      lcr_prg_data_ultima_atividade: new Date(),
    });
    await this.gravarSelosAtingidos(idUsuario, dados.quantidadePontos);
  }

  async registrarEvento(dados: {
    idUsuario: string;
    quantidadePontos: number;
    tipoOrigem: TipoOrigemPontos;
    codigoOrigem?: string;
    categoria?: string;
    transacao?: Transaction;
  }) {
    if (!this.banco) return { aplicado: false, ...(await this.obter(dados.idUsuario)) };
    if (!Number.isInteger(dados.quantidadePontos) || dados.quantidadePontos < 0) throw new Error('Pontuação inválida');
    const executar = async (transaction: Transaction) => {
      const codigoOrigem = dados.codigoOrigem?.trim() || randomUUID();
      const inseridos = await this.banco!.query<{ id_evento: string }>(
        `INSERT INTO lcr_eventos_pontos
           (lcr_evp_id_usuario, lcr_evp_tipo_origem, lcr_evp_codigo_origem, lcr_evp_categoria, lcr_evp_quantidade_pontos)
         VALUES (:idUsuario, :tipoOrigem, :codigoOrigem, :categoria, :quantidadePontos)
         ON CONFLICT (lcr_evp_id_usuario, lcr_evp_tipo_origem, lcr_evp_codigo_origem) DO NOTHING
         RETURNING lcr_evp_id_evento AS id_evento`,
        {
          replacements: {
            idUsuario: dados.idUsuario,
            tipoOrigem: dados.tipoOrigem,
            codigoOrigem,
            categoria: dados.categoria ?? null,
            quantidadePontos: dados.quantidadePontos,
          },
          type: QueryTypes.SELECT,
          transaction,
        },
      );
      const [progresso] = await ModeloProgressoUsuario.findOrCreate({
        where: { lcr_prg_id_usuario: dados.idUsuario },
        defaults: {
          lcr_prg_id_usuario: dados.idUsuario,
          lcr_prg_quantidade_pontos: 0,
          lcr_prg_nivel_gamificacao: 'iniciante',
          lcr_prg_sequencia_dias: 0,
          lcr_prg_data_ultima_atividade: null,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!inseridos.length) {
        return { aplicado: false, quantidadePontos: progresso.lcr_prg_quantidade_pontos, nivelGamificacao: progresso.lcr_prg_nivel_gamificacao };
      }
      const novoTotal = progresso.lcr_prg_quantidade_pontos + dados.quantidadePontos;
      const nivel = calcularNivel(novoTotal);
      await progresso.update({
        lcr_prg_quantidade_pontos: novoTotal,
        lcr_prg_nivel_gamificacao: nivel,
        lcr_prg_data_ultima_atividade: new Date(),
      }, { transaction });
      await this.gravarSelosAtingidos(dados.idUsuario, novoTotal, transaction);
      return { aplicado: true, quantidadePontos: novoTotal, nivelGamificacao: nivel };
    };
    if (dados.transacao) return executar(dados.transacao);
    return this.banco.transaction(executar);
  }

  async listarSelos(idUsuario: string): Promise<SeloUsuario[]> {
    if (!this.banco) return [];
    const linhas = await this.banco.query<{
      codigo: string; nome: string; descricao: string; pontos_minimos: number; icone: string;
      data_conquista: Date | null;
    }>(
      `SELECT s.lcr_sel_codigo AS codigo,
              s.lcr_sel_nome AS nome,
              s.lcr_sel_descricao AS descricao,
              s.lcr_sel_pontos_minimos AS pontos_minimos,
              s.lcr_sel_icone AS icone,
              us.lcr_usu_data_conquista AS data_conquista
       FROM lcr_selos s
       LEFT JOIN lcr_usuarios_selos us
         ON us.lcr_usu_id_selo = s.lcr_sel_id_selo AND us.lcr_usu_id_usuario = :idUsuario
       WHERE s.lcr_sel_ativo = true
       ORDER BY s.lcr_sel_pontos_minimos ASC`,
      { replacements: { idUsuario }, type: QueryTypes.SELECT },
    );
    return linhas.map(linha => ({
      codigo: linha.codigo,
      nome: linha.nome,
      descricao: linha.descricao,
      pontosMinimos: Number(linha.pontos_minimos),
      icone: linha.icone,
      conquistado: linha.data_conquista !== null,
      dataConquista: linha.data_conquista ? new Date(linha.data_conquista).toISOString() : '',
    }));
  }

  async ranking(limiteResultado = 10) {
    if (!this.banco) return [];
    const limite = Math.min(50, Math.max(1, limiteResultado));
    const linhas = await this.banco.query<{ quantidade_pontos: number; nivel_gamificacao: string }>(
      `SELECT progresso.lcr_prg_quantidade_pontos AS quantidade_pontos,
              progresso.lcr_prg_nivel_gamificacao AS nivel_gamificacao
       FROM lcr_progresso_usuarios progresso
       INNER JOIN lcr_usuarios usuario ON usuario.lcr_usr_id_usuario = progresso.lcr_prg_id_usuario
       WHERE usuario.lcr_usr_status_usuario = 'ativo'
       ORDER BY progresso.lcr_prg_quantidade_pontos DESC, progresso.lcr_prg_id_usuario ASC
       LIMIT :limite`,
      { replacements: { limite }, type: QueryTypes.SELECT },
    );
    return linhas.map((linha, indice) => ({
      posicaoRanking: indice + 1,
      nomeUsuario: `Participante ${String(indice + 1).padStart(2, '0')}`,
      quantidadePontos: Number(linha.quantidade_pontos),
      nivelGamificacao: linha.nivel_gamificacao,
    }));
  }

  private async resumirPontosPorOrigem(idUsuario: string): Promise<ResumoPontosOrigem[]> {
    if (!this.banco) return [];
    const linhas = await this.banco.query<{ origem: TipoOrigemPontos; pontos: number; eventos: number }>(
      `SELECT lcr_evp_tipo_origem AS origem,
              SUM(lcr_evp_quantidade_pontos)::integer AS pontos,
              COUNT(*)::integer AS eventos
       FROM lcr_eventos_pontos
       WHERE lcr_evp_id_usuario = :idUsuario
       GROUP BY lcr_evp_tipo_origem
       ORDER BY lcr_evp_tipo_origem`,
      { replacements: { idUsuario }, type: QueryTypes.SELECT },
    );
    return linhas.map(linha => ({ origem: linha.origem, quantidadePontos: Number(linha.pontos), quantidadeEventos: Number(linha.eventos) }));
  }

  private async gravarSelosAtingidos(idUsuario: string, totalPontos: number, transaction?: Transaction) {
    if (!this.banco) return;
    await this.banco.query(
      `INSERT INTO lcr_usuarios_selos (lcr_usu_id_usuario, lcr_usu_id_selo)
       SELECT :idUsuario, lcr_sel_id_selo
       FROM lcr_selos
       WHERE lcr_sel_ativo = true AND lcr_sel_pontos_minimos <= :totalPontos
       ON CONFLICT (lcr_usu_id_usuario, lcr_usu_id_selo) DO NOTHING`,
      { replacements: { idUsuario, totalPontos }, transaction },
    );
  }
}

function calcularNivel(pontos: number): string {
  if (pontos >= 4000) return 'guerreiro_ecologico';
  if (pontos >= 2000) return 'agente_ambiental';
  if (pontos >= 1000) return 'reciclador';
  if (pontos >= 500) return 'explorador';
  return 'iniciante';
}
