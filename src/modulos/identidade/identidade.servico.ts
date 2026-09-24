import { Inject, Injectable } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { ModeloUsuario } from '../../infraestrutura/banco/modelos/usuario.modelo.js';

export interface IdentidadeInterna {
  idUsuario: string;
  idExterno: string;
  nome: string;
  email: string;
  status: 'ativo' | 'bloqueado' | 'anonimizado';
}

@Injectable()
export class ServicoIdentidade {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async obterPorIdExterno(idExterno: string): Promise<IdentidadeInterna | null> {
    if (!this.banco) return null;
    const usuario = await ModeloUsuario.findOne({ where: { lcr_usr_id_externo: idExterno } });
    if (!usuario) return null;
    return {
      idUsuario: usuario.lcr_usr_id_usuario,
      idExterno: usuario.lcr_usr_id_externo,
      nome: usuario.lcr_usr_nome,
      email: usuario.lcr_usr_email,
      status: usuario.lcr_usr_status_usuario,
    };
  }

  async exigirAtivo(idExterno: string): Promise<IdentidadeInterna> {
    const identidade = await this.obterPorIdExterno(idExterno);
    if (!identidade || identidade.status !== 'ativo') throw new Error('Identidade sem acesso ativo');
    return identidade;
  }
}
