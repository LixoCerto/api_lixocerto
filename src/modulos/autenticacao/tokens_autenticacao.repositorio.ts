import { Inject, Injectable } from '@nestjs/common';
import { Op, Sequelize } from 'sequelize';
import { ModeloTokenAutenticacao, TipoTokenAutenticacao } from '../../infraestrutura/banco/modelos/token_autenticacao.modelo.js';

export interface DadosCriacaoToken {
  idUsuario: string;
  tipo: TipoTokenAutenticacao;
  hashToken: string;
  dataExpiracao: Date;
  enderecoIp?: string | null;
  agenteUsuario?: string | null;
}

export interface TokenPersistido {
  idToken: string;
  idUsuario: string;
  tipo: TipoTokenAutenticacao;
  /** Hash derivado do código. Usado para comparar o valor digitado sem expor o código. */
  hashToken: string;
  dataExpiracao: Date;
  quantidadeTentativas: number;
  consumido: boolean;
  expirado: boolean;
}

@Injectable()
export class RepositorioTokensAutenticacao {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  /**
   * Cria o token e invalida os anteriores do mesmo tipo para o usuário.
   * Cada nova solicitação substitui a anterior, evitando acúmulo de links válidos.
   */
  async criar(dados: DadosCriacaoToken): Promise<boolean> {
    if (!this.banco) return false;
    await ModeloTokenAutenticacao.update(
      { lcr_tka_data_consumo: new Date() },
      {
        where: {
          lcr_tka_id_usuario: dados.idUsuario,
          lcr_tka_tipo_token: dados.tipo,
          lcr_tka_data_consumo: null,
        },
      },
    );
    await ModeloTokenAutenticacao.create({
      lcr_tka_id_usuario: dados.idUsuario,
      lcr_tka_tipo_token: dados.tipo,
      lcr_tka_hash_token: dados.hashToken,
      lcr_tka_data_expiracao: dados.dataExpiracao,
      lcr_tka_data_consumo: null,
      lcr_tka_quantidade_tentativas: 0,
      lcr_tka_endereco_ip: dados.enderecoIp ?? null,
      lcr_tka_agente_usuario: dados.agenteUsuario?.slice(0, 2000) ?? null,
    });
    return true;
  }

  /**
   * Busca o token pelo hash independentemente do estado.
   * O estado é devolvido para que o serviço diferencie expirado, consumido e reutilizado.
   */
  async buscarPorHash(hashToken: string, tipo: TipoTokenAutenticacao): Promise<TokenPersistido | null> {
    if (!this.banco) return null;
    const token = await ModeloTokenAutenticacao.findOne({
      where: { lcr_tka_hash_token: hashToken, lcr_tka_tipo_token: tipo },
    });
    if (!token) return null;
    return {
      idToken: token.lcr_tka_id_token,
      idUsuario: token.lcr_tka_id_usuario,
      tipo: token.lcr_tka_tipo_token,
      hashToken: token.lcr_tka_hash_token,
      dataExpiracao: token.lcr_tka_data_expiracao,
      quantidadeTentativas: token.lcr_tka_quantidade_tentativas,
      consumido: token.lcr_tka_data_consumo !== null,
      expirado: token.lcr_tka_data_expiracao.getTime() <= Date.now(),
    };
  }

  /** Consumo de uso único: só marca como usado se ainda estiver pendente e não expirado. */
  async consumir(idToken: string): Promise<boolean> {
    if (!this.banco) return false;
    const [quantidade] = await ModeloTokenAutenticacao.update(
      { lcr_tka_data_consumo: new Date() },
      {
        where: {
          lcr_tka_id_token: idToken,
          lcr_tka_data_consumo: null,
          lcr_tka_data_expiracao: { [Op.gt]: new Date() },
        },
      },
    );
    return quantidade > 0;
  }

  /**
   * Busca o código pendente mais recente do usuário para um tipo.
   *
   * Usada no lugar da busca por hash porque o código tem apenas 6 caracteres e
   * a tentativa precisa ser contada mesmo quando o valor informado está errado:
   * é o registro do usuário que acumula tentativas e é invalidado no limite.
   */
  async buscarPendenteDoUsuario(idUsuario: string, tipo: TipoTokenAutenticacao): Promise<TokenPersistido | null> {
    if (!this.banco) return null;
    const token = await ModeloTokenAutenticacao.findOne({
      where: {
        lcr_tka_id_usuario: idUsuario,
        lcr_tka_tipo_token: tipo,
        lcr_tka_data_consumo: null,
        lcr_tka_data_expiracao: { [Op.gt]: new Date() },
      },
      order: [['lcr_tka_data_criacao', 'DESC']],
    });
    if (!token) return null;
    return {
      idToken: token.lcr_tka_id_token,
      idUsuario: token.lcr_tka_id_usuario,
      tipo: token.lcr_tka_tipo_token,
      hashToken: token.lcr_tka_hash_token,
      dataExpiracao: token.lcr_tka_data_expiracao,
      quantidadeTentativas: token.lcr_tka_quantidade_tentativas,
      consumido: false,
      expirado: false,
    };
  }

  /**
   * Verifica se o hash já está em uso por um código pendente.
   * Protege contra colisão de geração: dois usuários com o mesmo código ativo
   * tornariam a confirmação ambígua.
   */
  async hashEmUso(hashToken: string, tipo: TipoTokenAutenticacao): Promise<boolean> {
    if (!this.banco) return false;
    const existente = await ModeloTokenAutenticacao.findOne({
      where: {
        lcr_tka_hash_token: hashToken,
        lcr_tka_tipo_token: tipo,
        lcr_tka_data_consumo: null,
        lcr_tka_data_expiracao: { [Op.gt]: new Date() },
      },
      attributes: ['lcr_tka_id_token'],
    });
    return existente !== null;
  }

  /** Registra tentativa inválida e invalida o token ao atingir o limite. */
  async registrarTentativa(idToken: string, limiteTentativas: number): Promise<number> {
    if (!this.banco) return 0;
    const token = await ModeloTokenAutenticacao.findByPk(idToken);
    if (!token) return 0;
    const tentativas = token.lcr_tka_quantidade_tentativas + 1;
    await token.update({
      lcr_tka_quantidade_tentativas: tentativas,
      lcr_tka_data_consumo: tentativas >= limiteTentativas ? new Date() : token.lcr_tka_data_consumo,
    });
    return tentativas;
  }

  /** Consome todos os tokens pendentes do usuário para um tipo. */
  async consumirPendentesDoUsuario(idUsuario: string, tipo: TipoTokenAutenticacao): Promise<number> {
    if (!this.banco) return 0;
    const [quantidade] = await ModeloTokenAutenticacao.update(
      { lcr_tka_data_consumo: new Date() },
      {
        where: {
          lcr_tka_id_usuario: idUsuario,
          lcr_tka_tipo_token: tipo,
          lcr_tka_data_consumo: null,
        },
      },
    );
    return quantidade;
  }
}
