import { Inject, Injectable } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { ModeloPapel } from '../../infraestrutura/banco/modelos/papel.modelo.js';

@Injectable()
export class ServicoPapeis {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async listarAtivos() {
    if (!this.banco) return [];
    return ModeloPapel.findAll({
      where: { lcr_pap_status_papel: 'ativo' },
      order: [['lcr_pap_nome_papel', 'ASC']],
    });
  }
}
