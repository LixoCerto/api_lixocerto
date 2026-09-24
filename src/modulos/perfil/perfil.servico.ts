import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { ModeloUsuario } from '../../infraestrutura/banco/modelos/usuario.modelo.js';
import { ServicoIdentidade } from '../identidade/identidade.servico.js';

export interface PerfilAtual {
  idUsuario: string;
  idExterno: string;
  nome: string;
  email: string;
  status: string;
  papeis: string[];
  permissoes: string[];
}

@Injectable()
export class ServicoPerfil {
  constructor(
    @Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null,
    private readonly identidade: ServicoIdentidade,
  ) {}

  async obter(idExterno: string, papeis: string[], permissoes: string[]): Promise<PerfilAtual> {
    const interno = await this.identidade.exigirAtivo(idExterno);
    return {
      idUsuario: interno.idUsuario,
      idExterno: interno.idExterno,
      nome: interno.nome,
      email: interno.email,
      status: interno.status,
      papeis: [...papeis],
      permissoes: [...permissoes],
    };
  }

  async atualizarNome(idExterno: string, nome: string, papeis: string[], permissoes: string[]): Promise<PerfilAtual> {
    if (!this.banco) throw new Error('Banco de dados indisponível');
    const nomeNormalizado = nome.trim().replace(/\s+/g, ' ');
    if (nomeNormalizado.length < 2 || nomeNormalizado.length > 180 || /[\u0000-\u001f]/.test(nomeNormalizado)) {
      throw new BadRequestException('Nome de perfil inválido');
    }
    const interno = await this.identidade.exigirAtivo(idExterno);
    const usuario = await ModeloUsuario.findByPk(interno.idUsuario);
    if (!usuario) throw new Error('Usuário interno não encontrado');
    await usuario.update({ lcr_usr_nome: nomeNormalizado });
    return {
      idUsuario: usuario.lcr_usr_id_usuario,
      idExterno: usuario.lcr_usr_id_externo,
      nome: usuario.lcr_usr_nome,
      email: usuario.lcr_usr_email,
      status: usuario.lcr_usr_status_usuario,
      papeis: [...papeis],
      permissoes: [...permissoes],
    };
  }
}
