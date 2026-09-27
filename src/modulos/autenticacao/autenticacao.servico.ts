import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { status as codigoGrpc } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { Op, Sequelize } from 'sequelize';
import { UsuarioAutenticado } from '../../comum/autenticacao/usuario_autenticado.js';
import { ModeloSessao } from '../../infraestrutura/banco/modelos/sessao.modelo.js';
import { ModeloUsuario } from '../../infraestrutura/banco/modelos/usuario.modelo.js';
import { ServicoUsuarios } from '../usuarios/usuarios.servico.js';
import { criarHashSenha, senhaValida, verificarSenha } from './senha.util.js';
import {
  EXPIRACAO_TOKEN_ATUALIZACAO_DIAS,
  EXPIRACAO_TOKEN_ACESSO_SEGUNDOS,
  VerificadorJwtServico,
} from './verificador_jwt.servico.js';

export interface ContextoSessao {
  enderecoIp?: string;
  agenteUsuario?: string;
}

export interface RespostaAutenticacao {
  tokenAcesso: string;
  tokenAtualizacao: string;
  expiraEmSegundos: number;
  identidade: UsuarioAutenticado;
}

@Injectable()
export class ServicoAutenticacao {
  constructor(
    private readonly verificadorJwt: VerificadorJwtServico,
    private readonly usuarios: ServicoUsuarios,
    @Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null,
  ) {}

  async cadastrarUsuario(nome: string, email: string, senha: string, contexto?: ContextoSessao): Promise<RespostaAutenticacao> {
    this.validarCadastro(nome, email, senha);
    let identidade: UsuarioAutenticado;
    try {
      identidade = await this.usuarios.cadastrarUsuarioLocal({
        nome,
        email,
        hashSenha: await criarHashSenha(senha),
      });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : '';
      if (mensagem === 'Email ja cadastrado') this.erro(codigoGrpc.ALREADY_EXISTS, mensagem);
      if (mensagem === 'Banco de dados indisponivel') this.erro(codigoGrpc.UNAVAILABLE, mensagem);
      throw erro;
    }
    return this.emitirTokens(identidade, contexto);
  }

  async entrar(email: string, senha: string, contexto?: ContextoSessao): Promise<RespostaAutenticacao> {
    const emailNormalizado = email.trim().toLowerCase();
    if (!emailNormalizado || !senha) this.erro(codigoGrpc.INVALID_ARGUMENT, 'Email e senha sao obrigatorios');
    const credencial = await this.usuarios.obterCredencialPorEmail(emailNormalizado);
    if (!credencial || !credencial.hashSenha || !(await verificarSenha(senha, credencial.hashSenha))) {
      this.erro(codigoGrpc.UNAUTHENTICATED, 'Email ou senha invalidos');
    }
    if (credencial.status !== 'ativo') this.erro(codigoGrpc.PERMISSION_DENIED, 'Usuario sem acesso ativo');
    let identidade: UsuarioAutenticado | null;
    try {
      identidade = await this.usuarios.obterIdentidadeLocal(credencial.idExterno);
    } catch {
      this.erro(codigoGrpc.UNAUTHENTICATED, 'Usuario sem identidade local valida');
    }
    if (!identidade) this.erro(codigoGrpc.UNAUTHENTICATED, 'Usuario nao encontrado');
    return this.emitirTokens(identidade, contexto);
  }

  async renovarToken(tokenAtualizacao: string, contexto?: ContextoSessao): Promise<RespostaAutenticacao> {
    if (!tokenAtualizacao.trim() || !this.banco) this.erro(codigoGrpc.UNAUTHENTICATED, 'Token de atualizacao invalido');
    const sessao = await ModeloSessao.findOne({
      where: {
        lcr_ses_hash_token_atualizacao: this.hash(tokenAtualizacao),
        lcr_ses_data_revogacao: null,
        lcr_ses_data_expiracao: { [Op.gt]: new Date() },
      },
    });
    if (!sessao) this.erro(codigoGrpc.UNAUTHENTICATED, 'Token de atualizacao invalido ou expirado');
    const usuario = await ModeloUsuario.findByPk(sessao.lcr_ses_id_usuario);
    if (!usuario || usuario.lcr_usr_status_usuario !== 'ativo') this.erro(codigoGrpc.UNAUTHENTICATED, 'Sessao sem usuario ativo');
    const identidade = await this.usuarios.obterIdentidadeLocal(usuario.lcr_usr_id_externo);
    if (!identidade) this.erro(codigoGrpc.UNAUTHENTICATED, 'Identidade nao encontrada');

    const tokenAcesso = await this.verificadorJwt.assinarTokenAcesso(identidade);
    const novoTokenAtualizacao = this.verificadorJwt.criarTokenAtualizacao();
    await sessao.update({
      lcr_ses_hash_token: this.hash(tokenAcesso),
      lcr_ses_hash_token_atualizacao: this.hash(novoTokenAtualizacao),
      lcr_ses_data_expiracao: this.dataExpiracaoAtualizacao(),
      lcr_ses_endereco_ip: contexto?.enderecoIp ?? sessao.lcr_ses_endereco_ip,
      lcr_ses_agente_usuario: contexto?.agenteUsuario?.slice(0, 2000) ?? sessao.lcr_ses_agente_usuario,
    });
    return { tokenAcesso, tokenAtualizacao: novoTokenAtualizacao, expiraEmSegundos: EXPIRACAO_TOKEN_ACESSO_SEGUNDOS, identidade };
  }

  async sair(tokenAtualizacao: string): Promise<boolean> {
    if (!this.banco || !tokenAtualizacao.trim()) return false;
    const [quantidade] = await ModeloSessao.update(
      { lcr_ses_data_revogacao: new Date() },
      { where: { lcr_ses_hash_token_atualizacao: this.hash(tokenAtualizacao), lcr_ses_data_revogacao: null } },
    );
    return quantidade > 0;
  }

  async obterIdentidadeAtual(valorAutorizacao?: string): Promise<UsuarioAutenticado> {
    const token = this.verificadorJwt.extrairToken(valorAutorizacao);
    const identidadeToken = await this.verificadorJwt.verificar(token);
    if (this.banco) {
      const sessao = await ModeloSessao.findOne({
        where: {
          lcr_ses_hash_token: this.hash(token),
          lcr_ses_data_revogacao: null,
          lcr_ses_data_expiracao: { [Op.gt]: new Date() },
        },
      });
      if (!sessao) this.erro(codigoGrpc.UNAUTHENTICATED, 'Sessao invalida ou revogada');
    }
    const identidadeLocal = await this.usuarios.obterIdentidadeLocal(identidadeToken.idExterno);
    if (!identidadeLocal) this.erro(codigoGrpc.UNAUTHENTICATED, 'Identidade local nao encontrada');
    return identidadeLocal;
  }

  private async emitirTokens(identidade: UsuarioAutenticado, contexto?: ContextoSessao): Promise<RespostaAutenticacao> {
    const tokenAcesso = await this.verificadorJwt.assinarTokenAcesso(identidade);
    const tokenAtualizacao = this.verificadorJwt.criarTokenAtualizacao();
    if (!this.banco) this.erro(codigoGrpc.UNAVAILABLE, 'Banco de dados indisponivel');
    const idUsuario = await this.usuarios.obterIdInterno(identidade.idExterno);
    if (!idUsuario) this.erro(codigoGrpc.UNAUTHENTICATED, 'Usuario local nao encontrado');
    await ModeloSessao.create({
      lcr_ses_id_usuario: idUsuario,
      lcr_ses_hash_token: this.hash(tokenAcesso),
      lcr_ses_hash_token_atualizacao: this.hash(tokenAtualizacao),
      lcr_ses_endereco_ip: contexto?.enderecoIp ?? null,
      lcr_ses_agente_usuario: contexto?.agenteUsuario?.slice(0, 2000) ?? null,
      lcr_ses_data_expiracao: this.dataExpiracaoAtualizacao(),
      lcr_ses_data_revogacao: null,
    });
    return { tokenAcesso, tokenAtualizacao, expiraEmSegundos: EXPIRACAO_TOKEN_ACESSO_SEGUNDOS, identidade };
  }

  private validarCadastro(nome: string, email: string, senha: string): void {
    if (nome.trim().length < 2 || nome.trim().length > 180) this.erro(codigoGrpc.INVALID_ARGUMENT, 'Nome deve possuir entre 2 e 180 caracteres');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) this.erro(codigoGrpc.INVALID_ARGUMENT, 'Email invalido');
    if (!senhaValida(senha)) this.erro(codigoGrpc.INVALID_ARGUMENT, 'Senha deve possuir no minimo 12 caracteres, letras e numeros');
  }

  private dataExpiracaoAtualizacao(): Date {
    return new Date(Date.now() + EXPIRACAO_TOKEN_ATUALIZACAO_DIAS * 24 * 60 * 60 * 1000);
  }

  private hash(valor: string): string {
    return createHash('sha256').update(valor, 'utf8').digest('hex');
  }

  private erro(codigo: number, mensagem: string): never {
    throw new RpcException({ code: codigo, message: mensagem });
  }
}
