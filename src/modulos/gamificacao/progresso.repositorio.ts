import { Inject, Injectable } from '@nestjs/common';
import { QueryTypes, Sequelize } from 'sequelize';
import { ModeloProgressoUsuario } from '../../infraestrutura/banco/modelos/progresso_usuario.modelo.js';

@Injectable()
export class RepositorioProgresso {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async obter(idUsuario: string) {
    if (!this.banco) {
      return { quantidadePontos: 0, nivelGamificacao: 'iniciante', sequenciaDias: 0, quantidadeConquistas: 0 };
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

    return {
      quantidadePontos: progresso.lcr_prg_quantidade_pontos,
      nivelGamificacao: progresso.lcr_prg_nivel_gamificacao,
      sequenciaDias: progresso.lcr_prg_sequencia_dias,
      quantidadeConquistas: 0,
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
  }

  async ranking(limiteResultado = 10) {
    if (!this.banco) return [];
    const limite = Math.min(50, Math.max(1, limiteResultado));
    const linhas = await this.banco.query<{
      quantidade_pontos: number;
      nivel_gamificacao: string;
    }>(
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
}
