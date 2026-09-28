import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Op, Sequelize } from 'sequelize';
import { ModeloSessao } from '../../infraestrutura/banco/modelos/sessao.modelo.js';
import { ServicoIdentidade } from '../identidade/identidade.servico.js';

export interface SessaoResumo {
  idSessao: string;
  enderecoIp: string | null;
  agenteUsuario: string | null;
  dataExpiracao: Date;
  dataRevogacao: Date | null;
  dataCriacao: Date;
}

@Injectable()
export class ServicoSessoes {
  constructor(
    @Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null,
    private readonly identidade: ServicoIdentidade,
  ) {}

  private hash(valor: string): string {
    return createHash('sha256').update(valor, 'utf8').digest('hex');
  }

  async registrar(dados: {
    idExterno: string;
    token: string;
    tokenAtualizacao: string;
    enderecoIp?: string;
    agenteUsuario?: string;
    dataExpiracao: Date;
  }): Promise<string | null> {
    if (!this.banco) return null;
    const usuario = await this.identidade.exigirAtivo(dados.idExterno);
    const sessao = await ModeloSessao.create({
      lcr_ses_id_usuario: usuario.idUsuario,
      lcr_ses_hash_token: this.hash(dados.token),
      lcr_ses_hash_token_atualizacao: this.hash(dados.tokenAtualizacao),
      lcr_ses_endereco_ip: dados.enderecoIp ?? null,
      lcr_ses_agente_usuario: dados.agenteUsuario?.slice(0, 2000) ?? null,
      lcr_ses_data_expiracao: dados.dataExpiracao,
      lcr_ses_data_revogacao: null,
    });
    return sessao.lcr_ses_id_sessao;
  }

  async listar(idExterno: string): Promise<SessaoResumo[]> {
    if (!this.banco) return [];
    const usuario = await this.identidade.exigirAtivo(idExterno);
    const sessoes = await ModeloSessao.findAll({
      where: {
        lcr_ses_id_usuario: usuario.idUsuario,
        lcr_ses_data_expiracao: { [Op.gte]: new Date() },
        lcr_ses_data_revogacao: null,
      },
      order: [['lcr_ses_data_criacao', 'DESC']],
      limit: 50,
    });
    return sessoes.map(sessao => ({
      idSessao: sessao.lcr_ses_id_sessao,
      enderecoIp: sessao.lcr_ses_endereco_ip,
      agenteUsuario: sessao.lcr_ses_agente_usuario,
      dataExpiracao: sessao.lcr_ses_data_expiracao,
      dataRevogacao: sessao.lcr_ses_data_revogacao,
      dataCriacao: sessao.lcr_ses_data_criacao,
    }));
  }

  async revogar(idExterno: string, idSessao: string): Promise<boolean> {
    if (!this.banco) return false;
    const usuario = await this.identidade.exigirAtivo(idExterno);
    const [quantidade] = await ModeloSessao.update(
      { lcr_ses_data_revogacao: new Date() },
      { where: { lcr_ses_id_sessao: idSessao, lcr_ses_id_usuario: usuario.idUsuario, lcr_ses_data_revogacao: null } },
    );
    return quantidade > 0;
  }

  async revogarTodas(idExterno: string): Promise<number> {
    if (!this.banco) return 0;
    const usuario = await this.identidade.exigirAtivo(idExterno);
    const [quantidade] = await ModeloSessao.update(
      { lcr_ses_data_revogacao: new Date() },
      { where: { lcr_ses_id_usuario: usuario.idUsuario, lcr_ses_data_revogacao: null } },
    );
    return quantidade;
  }
}
