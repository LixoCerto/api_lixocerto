import { Inject, Injectable } from '@nestjs/common';
import { Sequelize } from 'sequelize';
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
}
