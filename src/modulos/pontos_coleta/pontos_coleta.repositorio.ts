import { Inject, Injectable } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { ModeloPontoColeta } from '../../infraestrutura/banco/modelos/ponto_coleta.modelo.js';

export interface FiltroPontosColeta {
  cidadePontoColeta?: string;
}

@Injectable()
export class RepositorioPontosColeta {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async listar(filtro: FiltroPontosColeta) {
    if (!this.banco) return [];

    const condicoes: Record<string, unknown> = {
      lcr_pco_status_verificacao: 'verificado',
    };
    if (filtro.cidadePontoColeta?.trim()) {
      condicoes.lcr_pco_cidade_ponto_coleta = filtro.cidadePontoColeta.trim();
    }

    return ModeloPontoColeta.findAll({
      where: condicoes,
      order: [['lcr_pco_nome_ponto_coleta', 'ASC']],
      limit: 100,
    });
  }
}
