import { randomUUID } from 'node:crypto';
import { status as codigoGrpc } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { registrarEvento } from '../../comum/observabilidade/registrador.js';
import { ServicoEmail } from '../../infraestrutura/email/email.servico.js';
import { montarEmailRedefinicaoSenha, montarEmailVerificacao } from '../../infraestrutura/email/templates_email.js';
import { ServicoRateLimit } from '../../infraestrutura/cache/rate_limit.servico.js';
import { ServicoAuditoria } from '../auditoria/auditoria.servico.js';
import { ServicoUsuarios } from '../usuarios/usuarios.servico.js';
import {
  EXPIRACAO_REDEFINICAO_SENHA_MINUTOS,
  EXPIRACAO_VERIFICACAO_EMAIL_HORAS,
  JANELA_CONFIRMACOES_SEGUNDOS,
  JANELA_SOLICITACOES_SEGUNDOS,
  LIMITE_CONFIRMACOES_POR_ORIGEM,
  LIMITE_SOLICITACOES_POR_IDENTIFICADOR,
  LIMITE_SOLICITACOES_POR_ORIGEM,
  LIMITE_TENTATIVAS_TOKEN,
  MENSAGEM_SOLICITACAO_NEUTRA,
  expiracaoRedefinicaoSenha,
  expiracaoVerificacaoEmail,
} from './fluxos_email.constantes.js';
import { RepositorioTokensAutenticacao } from './tokens_autenticacao.repositorio.js';
import { criarHashSenha, senhaValida } from './senha.util.js';
import { gerarTokenUsoUnico, hashTokenUsoUnico, tokenUsoUnicoValido } from './token_uso_unico.util.js';

export interface ContextoFluxoEmail {
  enderecoIp?: string;
  agenteUsuario?: string;
}

export interface RespostaSolicitacao {
  solicitacaoAceita: boolean;
  expiraEmSegundos: number;
  mensagemResultado: string;
}

export interface RespostaConfirmacaoEmail {
  emailConfirmado: boolean;
  emailUsuario: string;
  mensagemResultado: string;
}

export interface RespostaRedefinicaoSenha {
  senhaRedefinida: boolean;
  sessoesRevogadas: number;
  mensagemResultado: string;
}

const MENSAGEM_EMAIL_CONFIRMADO = 'Email confirmado com sucesso.';
const MENSAGEM_SENHA_REDEFINIDA = 'Senha redefinida com sucesso. Entre novamente com a nova senha.';

@Injectable()
export class ServicoFluxosEmail {
  constructor(
    private readonly usuarios: ServicoUsuarios,
    private readonly tokens: RepositorioTokensAutenticacao,
    private readonly email: ServicoEmail,
    private readonly auditoria: ServicoAuditoria,
    private readonly rateLimit: ServicoRateLimit,
  ) {}

  /**
   * Solicita o envio do link de confirmação de e-mail.
   * A resposta é sempre neutra: não revela se o endereço existe na base.
   */
  async solicitarVerificacaoEmail(email: string, contexto?: ContextoFluxoEmail): Promise<RespostaSolicitacao> {
    const emailNormalizado = this.normalizarEmail(email);
    this.validarEmail(emailNormalizado);
    await this.protegerSolicitacao(emailNormalizado, 'verificacao_email', contexto);

    const credencial = await this.usuarios.obterCredencialPorEmail(emailNormalizado);
    if (!credencial) return this.respostaNeutra(EXPIRACAO_VERIFICACAO_EMAIL_HORAS * 3600);
    if (credencial.status !== 'ativo') {
      registrarEvento('verificacao_email_ignorada', { motivo: 'usuario_sem_acesso_ativo' });
      return this.respostaNeutra(EXPIRACAO_VERIFICACAO_EMAIL_HORAS * 3600);
    }

    const token = gerarTokenUsoUnico();
    const criado = await this.tokens.criar({
      idUsuario: credencial.idInterno,
      tipo: 'verificacao_email',
      hashToken: hashTokenUsoUnico(token),
      dataExpiracao: expiracaoVerificacaoEmail(),
      enderecoIp: contexto?.enderecoIp ?? null,
      agenteUsuario: contexto?.agenteUsuario ?? null,
    });
    if (!criado) this.erro(codigoGrpc.UNAVAILABLE, 'Banco de dados indisponivel');

    const url = this.montarUrl('confirmar-email', token);
    const mensagem = montarEmailVerificacao({
      nomeUsuario: credencial.nome,
      urlConfirmacao: url,
      expiraEmHoras: EXPIRACAO_VERIFICACAO_EMAIL_HORAS,
    });
    const envio = await this.email.enviar({ destinatario: credencial.email, ...mensagem });

    await this.registrarAuditoria('verificacao_email_solicitada', credencial.idExterno, contexto, {
      provedorEmail: envio.provedor,
      enviado: envio.enviado,
      idMensagem: envio.idMensagem,
    });

    // Se o provedor de e-mail está configurado e falhou, o token é invalidado para não
    // deixar um link válido que nunca chegou ao destinatário.
    if (!envio.enviado) {
      await this.tokens.consumirPendentesDoUsuario(credencial.idInterno, 'verificacao_email');
      this.erro(codigoGrpc.UNAVAILABLE, 'Nao foi possivel enviar o email de confirmacao. Tente novamente.');
    }

    return {
      solicitacaoAceita: true,
      expiraEmSegundos: EXPIRACAO_VERIFICACAO_EMAIL_HORAS * 3600,
      mensagemResultado: MENSAGEM_SOLICITACAO_NEUTRA,
    };
  }

  /** Consome o token de confirmação e marca o e-mail como verificado. */
  async confirmarEmail(token: string, contexto?: ContextoFluxoEmail): Promise<RespostaConfirmacaoEmail> {
    await this.protegerConfirmacao(contexto);
    const tokenLimpo = token?.trim() ?? '';
    if (!tokenUsoUnicoValido(tokenLimpo)) {
      this.erro(codigoGrpc.INVALID_ARGUMENT, 'Token de verificacao invalido ou expirado');
    }

    const registro = await this.tokens.buscarPorHash(hashTokenUsoUnico(tokenLimpo), 'verificacao_email');
    if (!registro) this.erro(codigoGrpc.INVALID_ARGUMENT, 'Token de verificacao invalido ou expirado');

    if (registro.consumido || registro.expirado) {
      await this.tokens.registrarTentativa(registro.idToken, LIMITE_TENTATIVAS_TOKEN);
      await this.registrarAuditoria('email_confirmacao_recusada', null, contexto, {
        motivo: registro.consumido ? 'token_ja_utilizado' : 'token_expirado',
      });
      this.erro(codigoGrpc.INVALID_ARGUMENT, 'Token de verificacao invalido ou expirado');
    }

    const credencial = await this.usuarios.obterCredencialPorIdInterno(registro.idUsuario);
    if (!credencial) {
      await this.tokens.registrarTentativa(registro.idToken, LIMITE_TENTATIVAS_TOKEN);
      this.erro(codigoGrpc.INVALID_ARGUMENT, 'Token de verificacao invalido ou expirado');
    }

    const consumido = await this.tokens.consumir(registro.idToken);
    if (!consumido) {
      await this.tokens.registrarTentativa(registro.idToken, LIMITE_TENTATIVAS_TOKEN);
      await this.registrarAuditoria('email_confirmacao_recusada', credencial.idExterno, contexto, { motivo: 'corrida_de_consumo' });
      this.erro(codigoGrpc.INVALID_ARGUMENT, 'Token de verificacao invalido ou expirado');
    }

    const emailConfirmado = await this.usuarios.marcarEmailVerificado(credencial.idInterno);
    if (!emailConfirmado) this.erro(codigoGrpc.UNAVAILABLE, 'Nao foi possivel confirmar o email agora');

    await this.registrarAuditoria('email_confirmado', credencial.idExterno, contexto, { email: this.mascararEmail(emailConfirmado) });
    return { emailConfirmado: true, emailUsuario: emailConfirmado, mensagemResultado: MENSAGEM_EMAIL_CONFIRMADO };
  }

  /**
   * Solicita a redefinição de senha.
   * A resposta é sempre neutra e o token anterior é invalidado por cada nova solicitação.
   */
  async solicitarRecuperacaoSenha(email: string, contexto?: ContextoFluxoEmail): Promise<RespostaSolicitacao> {
    const emailNormalizado = this.normalizarEmail(email);
    this.validarEmail(emailNormalizado);
    await this.protegerSolicitacao(emailNormalizado, 'redefinicao_senha', contexto);

    const credencial = await this.usuarios.obterCredencialPorEmail(emailNormalizado);
    if (!credencial) return this.respostaNeutra(EXPIRACAO_REDEFINICAO_SENHA_MINUTOS * 60);
    if (credencial.status !== 'ativo') {
      registrarEvento('recuperacao_senha_ignorada', { motivo: 'usuario_sem_acesso_ativo' });
      return this.respostaNeutra(EXPIRACAO_REDEFINICAO_SENHA_MINUTOS * 60);
    }

    const token = gerarTokenUsoUnico();
    const criado = await this.tokens.criar({
      idUsuario: credencial.idInterno,
      tipo: 'redefinicao_senha',
      hashToken: hashTokenUsoUnico(token),
      dataExpiracao: expiracaoRedefinicaoSenha(),
      enderecoIp: contexto?.enderecoIp ?? null,
      agenteUsuario: contexto?.agenteUsuario ?? null,
    });
    if (!criado) this.erro(codigoGrpc.UNAVAILABLE, 'Banco de dados indisponivel');

    const url = this.montarUrl('redefinir-senha', token);
    const mensagem = montarEmailRedefinicaoSenha({
      nomeUsuario: credencial.nome,
      urlRedefinicao: url,
      expiraEmMinutos: EXPIRACAO_REDEFINICAO_SENHA_MINUTOS,
    });
    const envio = await this.email.enviar({ destinatario: credencial.email, ...mensagem });

    await this.registrarAuditoria('recuperacao_senha_solicitada', credencial.idExterno, contexto, {
      provedorEmail: envio.provedor,
      enviado: envio.enviado,
      idMensagem: envio.idMensagem,
    });

    if (!envio.enviado) {
      await this.tokens.consumirPendentesDoUsuario(credencial.idInterno, 'redefinicao_senha');
      this.erro(codigoGrpc.UNAVAILABLE, 'Nao foi possivel enviar o email de recuperacao. Tente novamente.');
    }

    return {
      solicitacaoAceita: true,
      expiraEmSegundos: EXPIRACAO_REDEFINICAO_SENHA_MINUTOS * 60,
      mensagemResultado: MENSAGEM_SOLICITACAO_NEUTRA,
    };
  }

  /**
   * Redefine a senha com token de uso único e revoga todas as sessões do usuário,
   * encerrando qualquer acesso obtido com a senha anterior.
   */
  async redefinirSenha(token: string, novaSenha: string, contexto?: ContextoFluxoEmail): Promise<RespostaRedefinicaoSenha> {
    await this.protegerConfirmacao(contexto);
    const tokenLimpo = token?.trim() ?? '';
    if (!tokenUsoUnicoValido(tokenLimpo)) {
      this.erro(codigoGrpc.INVALID_ARGUMENT, 'Token de redefinicao invalido ou expirado');
    }
    if (!senhaValida(novaSenha)) {
      this.erro(codigoGrpc.INVALID_ARGUMENT, 'Senha deve possuir no minimo 12 caracteres, letras e numeros');
    }

    const registro = await this.tokens.buscarPorHash(hashTokenUsoUnico(tokenLimpo), 'redefinicao_senha');
    if (!registro) this.erro(codigoGrpc.INVALID_ARGUMENT, 'Token de redefinicao invalido ou expirado');

    if (registro.consumido || registro.expirado) {
      await this.tokens.registrarTentativa(registro.idToken, LIMITE_TENTATIVAS_TOKEN);
      await this.registrarAuditoria('redefinicao_senha_recusada', null, contexto, {
        motivo: registro.consumido ? 'token_ja_utilizado' : 'token_expirado',
      });
      this.erro(codigoGrpc.INVALID_ARGUMENT, 'Token de redefinicao invalido ou expirado');
    }

    const credencial = await this.usuarios.obterCredencialPorIdInterno(registro.idUsuario);
    if (!credencial) {
      await this.tokens.registrarTentativa(registro.idToken, LIMITE_TENTATIVAS_TOKEN);
      this.erro(codigoGrpc.INVALID_ARGUMENT, 'Token de redefinicao invalido ou expirado');
    }
    if (credencial.status !== 'ativo') this.erro(codigoGrpc.PERMISSION_DENIED, 'Usuario sem acesso ativo');

    const consumido = await this.tokens.consumir(registro.idToken);
    if (!consumido) {
      await this.tokens.registrarTentativa(registro.idToken, LIMITE_TENTATIVAS_TOKEN);
      await this.registrarAuditoria('redefinicao_senha_recusada', credencial.idExterno, contexto, { motivo: 'corrida_de_consumo' });
      this.erro(codigoGrpc.INVALID_ARGUMENT, 'Token de redefinicao invalido ou expirado');
    }

    const atualizado = await this.usuarios.definirHashSenha(credencial.idInterno, await criarHashSenha(novaSenha));
    if (!atualizado) this.erro(codigoGrpc.UNAVAILABLE, 'Nao foi possivel redefinir a senha agora');

    const sessoesRevogadas = await this.revogarSessoes(credencial.idInterno);
    await this.registrarAuditoria('senha_redefinida', credencial.idExterno, contexto, { sessoesRevogadas });
    return { senhaRedefinida: true, sessoesRevogadas, mensagemResultado: MENSAGEM_SENHA_REDEFINIDA };
  }

  private async revogarSessoes(idInterno: string): Promise<number> {
    return this.usuarios.revogarSessoes(idInterno);
  }

  private async protegerSolicitacao(email: string, operacao: string, contexto?: ContextoFluxoEmail): Promise<void> {
    const identificador = this.hashIdentificador(email);
    const porIdentificador = await this.rateLimit.permitir(
      `lcr:rate:${operacao}:email:${identificador}`,
      LIMITE_SOLICITACOES_POR_IDENTIFICADOR,
      JANELA_SOLICITACOES_SEGUNDOS,
    );
    this.exigirProtecaoDisponivel(porIdentificador.disponivel);
    if (!porIdentificador.permitido) this.erro(codigoGrpc.RESOURCE_EXHAUSTED, 'Muitas solicitacoes para este email. Aguarde alguns minutos.');

    const origem = contexto?.enderecoIp?.trim();
    if (!origem) return;
    const porOrigem = await this.rateLimit.permitir(
      `lcr:rate:${operacao}:ip:${origem}`,
      LIMITE_SOLICITACOES_POR_ORIGEM,
      JANELA_SOLICITACOES_SEGUNDOS,
    );
    this.exigirProtecaoDisponivel(porOrigem.disponivel);
    if (!porOrigem.permitido) this.erro(codigoGrpc.RESOURCE_EXHAUSTED, 'Muitas solicitacoes desta origem. Aguarde alguns minutos.');
  }

  private async protegerConfirmacao(contexto?: ContextoFluxoEmail): Promise<void> {
    const origem = contexto?.enderecoIp?.trim() ?? 'sem-origem';
    const resultado = await this.rateLimit.permitir(
      `lcr:rate:token_autenticacao:ip:${origem}`,
      LIMITE_CONFIRMACOES_POR_ORIGEM,
      JANELA_CONFIRMACOES_SEGUNDOS,
    );
    this.exigirProtecaoDisponivel(resultado.disponivel);
    if (!resultado.permitido) this.erro(codigoGrpc.RESOURCE_EXHAUSTED, 'Muitas tentativas desta origem. Aguarde alguns minutos.');
  }

  private exigirProtecaoDisponivel(disponivel: boolean): void {
    if (!disponivel) this.erro(codigoGrpc.UNAVAILABLE, 'Protecao contra abuso indisponivel');
  }

  private montarUrl(caminho: string, token: string): string {
    const base = (process.env.URL_PUBLICA_FRONTEND?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
    return `${base}/${caminho}?token=${encodeURIComponent(token)}`;
  }

  private respostaNeutra(expiraEmSegundos: number): RespostaSolicitacao {
    return { solicitacaoAceita: true, expiraEmSegundos, mensagemResultado: MENSAGEM_SOLICITACAO_NEUTRA };
  }

  private normalizarEmail(email: string): string {
    return (email ?? '').trim().toLowerCase();
  }

  private validarEmail(email: string): void {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) this.erro(codigoGrpc.INVALID_ARGUMENT, 'Email invalido');
  }

  private hashIdentificador(valor: string): string {
    return hashTokenUsoUnico(valor).slice(0, 32);
  }

  private mascararEmail(email: string): string {
    const [local, dominio] = email.split('@');
    if (!local || !dominio) return '[EMAIL_INVALIDO]';
    return `${local.slice(0, 1)}${'*'.repeat(Math.max(1, Math.min(6, local.length - 1)))}@${dominio}`;
  }

  private async registrarAuditoria(
    tipoEvento: string,
    idExterno: string | null,
    contexto: ContextoFluxoEmail | undefined,
    detalhes: Record<string, unknown>,
  ): Promise<void> {
    try {
      let idUsuario: string | null = null;
      if (idExterno) idUsuario = await this.usuarios.obterIdInterno(idExterno);
      await this.auditoria.registrar({
        idUsuario,
        tipoEvento,
        recursoEvento: 'autenticacao',
        enderecoIp: contexto?.enderecoIp,
        idCorrelacao: randomUUID(),
        detalhesEvento: detalhes,
      });
    } catch (erro) {
      registrarEvento('auditoria_fluxo_email_falhou', {
        tipoEvento,
        motivo: erro instanceof Error ? erro.message : 'erro_desconhecido',
      });
    }
  }

  private erro(codigo: number, mensagem: string): never {
    throw new RpcException({ code: codigo, message: mensagem });
  }
}
