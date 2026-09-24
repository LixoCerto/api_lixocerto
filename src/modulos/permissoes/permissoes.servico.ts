import { Inject, Injectable } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { ModeloPermissao } from '../../infraestrutura/banco/modelos/permissao.modelo.js';

@Injectable()
export class ServicoPermissoes {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async listarAtivas() {
    if (!this.banco) return [];
    return ModeloPermissao.findAll({
      where: { lcr_prm_status_permissao: 'ativo' },
      order: [['lcr_prm_codigo_permissao', 'ASC']],
    });
  }
}
