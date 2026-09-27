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
  COMPRIMENTO_CODIGO_VERIFICACAO,
  EXPIRACAO_REDEFINICAO_SENHA_MINUTOS,
  EXPIRACAO_VERIFICACAO_EMAIL_MINUTOS,
  JANELA_CONFIRMACOES_SEGUNDOS,
  JANELA_SOLICITACOES_SEGUNDOS,
  LIMITE_CONFIRMACOES_POR_ORIGEM,
  LIMITE_SOLICITACOES_POR_IDENTIFICADOR,
  LIMITE_SOLICITACOES_POR_ORIGEM,
  LIMITE_TENTATIVAS_CODIGO,
  MENSAGEM_SOLICITACAO_NEUTRA,
  expiracaoRedefinicaoSenha,
  expiracaoVerificacaoEmail,
} from './fluxos_email.constantes.js';
import { RepositorioTokensAutenticacao } from './tokens_autenticacao.repositorio.js';
import { criarHashSenha, senhaValida } from './senha.util.js';
import {
  TENTATIVAS_GERACAO_CODIGO,
  codigoVerificacaoValido,
  gerarCodigoVerificacao,
  hashCodigoVerificacao,
  normalizarCodigoVerificacao,
} from './codigo_verificacao.util.js';

export interface ContextoFluxoEmail {
  enderecoIp?: string;
  agenteUsuario?: string;
}

export interface RespostaSolicitacao {
  solicitacaoAceita: boolean;
  expiraEmSegundos: number;
  mensagemResultado: string;
  comprimentoCodigo: number;
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

/** Mensagens de recusa — idênticas para código errado, expirado ou já utilizado. */
const MENSAGEM_CODIGO_VERIFICACAO_INVALIDO = 'Codigo de verificacao invalido ou expirado';
const MENSAGEM_CODIGO_REDEFINICAO_INVALIDO = 'Codigo de redefinicao invalido ou expirado';

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
   * Envia o código de confirmação de e-mail.
   * A resposta é sempre neutra: não revela se o endereço existe na base.
   */
  async solicitarVerificacaoEmail(email: string, contexto?: ContextoFluxoEmail): Promise<RespostaSolicitacao> {
    const emailNormalizado = this.normalizarEmail(email);
    this.validarEmail(emailNormalizado);
    await this.protegerSolicitacao(emailNormalizado, 'verificacao_email', contexto);

    const credencial = await this.usuarios.obterCredencialPorEmail(emailNormalizado);
    if (!credencial) return this.respostaNeutra();
    if (credencial.status !== 'ativo') {
      registrarEvento('verificacao_email_ignorada', { motivo: 'usuario_sem_acesso_ativo' });
      return this.respostaNeutra();
    }

    const codigo = await this.gerarCodigoUnico(credencial.idInterno, 'verificacao_email');
    const criado = await this.tokens.criar({
      idUsuario: credencial.idInterno,
      tipo: 'verificacao_email',
      hashToken: hashCodigoVerificacao(codigo, 'verificacao_email'),
      dataExpiracao: expiracaoVerificacaoEmail(),
      enderecoIp: contexto?.enderecoIp ?? null,
      agenteUsuario: contexto?.agenteUsuario ?? null,
    });
    if (!criado) this.erro(codigoGrpc.UNAVAILABLE, 'Banco de dados indisponivel');

    const mensagem = montarEmailVerificacao({
      nomeUsuario: credencial.nome,
      codigo,
      expiraEmMinutos: EXPIRACAO_VERIFICACAO_EMAIL_MINUTOS,
    });
    const envio = await this.email.enviar({ destinatario: credencial.email, ...mensagem });

    await this.registrarAuditoria('verificacao_email_solicitada', credencial.idExterno, contexto, {
      provedorEmail: envio.provedor,
      enviado: envio.enviado,
      idMensagem: envio.idMensagem,
    });

    // Se o provedor está configurado e falhou, o código é invalidado para não
    // deixar um código válido que nunca chegou ao destinatário.
    if (!envio.enviado) {
      await this.tokens.consumirPendentesDoUsuario(credencial.idInterno, 'verificacao_email');
      this.erro(codigoGrpc.UNAVAILABLE, 'Nao foi possivel enviar o codigo de confirmacao. Tente novamente.');
    }

    return this.respostaNeutra();
  }

  /**
   * Valida o código digitado no aplicativo e marca o e-mail como verificado.
   *
   * O e-mail é exigido junto do código porque, com apenas 6 caracteres, o
   * código sozinho não é um identificador global: a busca é sempre pelo usuário.
   */
  async confirmarEmail(email: string, codigo: string, contexto?: ContextoFluxoEmail): Promise<RespostaConfirmacaoEmail> {
    const emailNormalizado = this.normalizarEmail(email);
    this.validarEmail(emailNormalizado);
    await this.protegerConfirmacao(contexto);

    const credencial = await this.usuarios.obterCredencialPorEmail(emailNormalizado);
    if (!credencial || credencial.status !== 'ativo') {
      await this.registrarAuditoria('email_confirmacao_recusada', null, contexto, { motivo: 'conta_inexistente_ou_inativa' });
      this.erro(codigoGrpc.INVALID_ARGUMENT, MENSAGEM_CODIGO_VERIFICACAO_INVALIDO);
    }

    const codigoNormalizado = normalizarCodigoVerificacao(codigo);
    const registro = await this.tokens.buscarPendenteDoUsuario(credencial.idInterno, 'verificacao_email');
    if (!registro) {
      await this.registrarAuditoria('email_confirmacao_recusada', credencial.idExterno, contexto, { motivo: 'sem_codigo_pendente' });
      this.erro(codigoGrpc.INVALID_ARGUMENT, MENSAGEM_CODIGO_VERIFICACAO_INVALIDO);
    }

    if (!codigoVerificacaoValido(codigoNormalizado) ||
        hashCodigoVerificacao(codigoNormalizado, 'verificacao_email') !== registro.hashToken) {
      await this.registrarTentativaInvalida(registro.idToken, credencial.idExterno, contexto);
      this.erro(codigoGrpc.INVALID_ARGUMENT, MENSAGEM_CODIGO_VERIFICACAO_INVALIDO);
    }

    const consumido = await this.tokens.consumir(registro.idToken);
    if (!consumido) {
      await this.registrarTentativaInvalida(registro.idToken, credencial.idExterno, contexto);
      this.erro(codigoGrpc.INVALID_ARGUMENT, MENSAGEM_CODIGO_VERIFICACAO_INVALIDO);
    }

    const emailConfirmado = await this.usuarios.marcarEmailVerificado(credencial.idInterno);
    if (!emailConfirmado) this.erro(codigoGrpc.UNAVAILABLE, 'Nao foi possivel confirmar o email agora');

    await this.registrarAuditoria('email_confirmado', credencial.idExterno, contexto, { email: this.mascararEmail(emailConfirmado) });
    return { emailConfirmado: true, emailUsuario: emailConfirmado, mensagemResultado: MENSAGEM_EMAIL_CONFIRMADO };
  }

  /**
   * Envia o código de redefinição de senha.
   * A resposta é sempre neutra e cada nova solicitação invalida o código anterior.
   */
  async solicitarRecuperacaoSenha(email: string, contexto?: ContextoFluxoEmail): Promise<RespostaSolicitacao> {
    const emailNormalizado = this.normalizarEmail(email);
    this.validarEmail(emailNormalizado);
    await this.protegerSolicitacao(emailNormalizado, 'redefinicao_senha', contexto);

    const credencial = await this.usuarios.obterCredencialPorEmail(emailNormalizado);
    if (!credencial) return this.respostaNeutra();
    if (credencial.status !== 'ativo') {
      registrarEvento('recuperacao_senha_ignorada', { motivo: 'usuario_sem_acesso_ativo' });
      return this.respostaNeutra();
    }

    const codigo = await this.gerarCodigoUnico(credencial.idInterno, 'redefinicao_senha');
    const criado = await this.tokens.criar({
      idUsuario: credencial.idInterno,
      tipo: 'redefinicao_senha',
      hashToken: hashCodigoVerificacao(codigo, 'redefinicao_senha'),
      dataExpiracao: expiracaoRedefinicaoSenha(),
      enderecoIp: contexto?.enderecoIp ?? null,
      agenteUsuario: contexto?.agenteUsuario ?? null,
    });
    if (!criado) this.erro(codigoGrpc.UNAVAILABLE, 'Banco de dados indisponivel');

    const mensagem = montarEmailRedefinicaoSenha({
      nomeUsuario: credencial.nome,
      codigo,
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
      this.erro(codigoGrpc.UNAVAILABLE, 'Nao foi possivel enviar o codigo de recuperacao. Tente novamente.');
    }

    return this.respostaNeutra();
  }

  /**
   * Redefine a senha com o código recebido e revoga todas as sessões do usuário,
   * encerrando qualquer acesso obtido com a senha anterior.
   */
  async redefinirSenha(
    email: string,
    codigo: string,
    novaSenha: string,
    contexto?: ContextoFluxoEmail,
  ): Promise<RespostaRedefinicaoSenha> {
    const emailNormalizado = this.normalizarEmail(email);
    this.validarEmail(emailNormalizado);
    await this.protegerConfirmacao(contexto);

    if (!senhaValida(novaSenha)) {
      this.erro(codigoGrpc.INVALID_ARGUMENT, 'Senha deve possuir no minimo 12 caracteres, letras e numeros');
    }

    const credencial = await this.usuarios.obterCredencialPorEmail(emailNormalizado);
    if (!credencial || credencial.status !== 'ativo') {
      await this.registrarAuditoria('redefinicao_senha_recusada', null, contexto, { motivo: 'conta_inexistente_ou_inativa' });
      this.erro(codigoGrpc.INVALID_ARGUMENT, MENSAGEM_CODIGO_REDEFINICAO_INVALIDO);
    }

    const codigoNormalizado = normalizarCodigoVerificacao(codigo);
    const registro = await this.tokens.buscarPendenteDoUsuario(credencial.idInterno, 'redefinicao_senha');
    if (!registro) {
      await this.registrarAuditoria('redefinicao_senha_recusada', credencial.idExterno, contexto, { motivo: 'sem_codigo_pendente' });
      this.erro(codigoGrpc.INVALID_ARGUMENT, MENSAGEM_CODIGO_REDEFINICAO_INVALIDO);
    }

    if (!codigoVerificacaoValido(codigoNormalizado) ||
        hashCodigoVerificacao(codigoNormalizado, 'redefinicao_senha') !== registro.hashToken) {
      await this.registrarTentativaInvalida(registro.idToken, credencial.idExterno, contexto);
      this.erro(codigoGrpc.INVALID_ARGUMENT, MENSAGEM_CODIGO_REDEFINICAO_INVALIDO);
    }

    const consumido = await this.tokens.consumir(registro.idToken);
    if (!consumido) {
      await this.registrarTentativaInvalida(registro.idToken, credencial.idExterno, contexto);
      this.erro(codigoGrpc.INVALID_ARGUMENT, MENSAGEM_CODIGO_REDEFINICAO_INVALIDO);
    }

    const atualizado = await this.usuarios.definirHashSenha(credencial.idInterno, await criarHashSenha(novaSenha));
    if (!atualizado) this.erro(codigoGrpc.UNAVAILABLE, 'Nao foi possivel redefinir a senha agora');

    const sessoesRevogadas = await this.revogarSessoes(credencial.idInterno);
    await this.registrarAuditoria('senha_redefinida', credencial.idExterno, contexto, { sessoesRevogadas });
    return { senhaRedefinida: true, sessoesRevogadas, mensagemResultado: MENSAGEM_SENHA_REDEFINIDA };
  }

  /**
   * Gera um código que não colide com outro código pendente do mesmo tipo.
   * A colisão tornaria ambígua a confirmação, então há retentativa limitada.
   */
  private async gerarCodigoUnico(idUsuario: string, tipo: 'verificacao_email' | 'redefinicao_senha'): Promise<string> {
    for (let tentativa = 0; tentativa < TENTATIVAS_GERACAO_CODIGO; tentativa += 1) {
      const codigo = gerarCodigoVerificacao();
      const emUso = await this.tokens.hashEmUso(hashCodigoVerificacao(codigo, tipo), tipo);
      if (!emUso) return codigo;
    }
    registrarEvento('codigo_verificacao_colisao', { tipo });
    this.erro(codigoGrpc.UNAVAILABLE, 'Nao foi possivel gerar o codigo agora. Tente novamente.');
  }

  private async registrarTentativaInvalida(idToken: string, idExterno: string, contexto?: ContextoFluxoEmail): Promise<void> {
    const tentativas = await this.tokens.registrarTentativa(idToken, LIMITE_TENTATIVAS_CODIGO);
    await this.registrarAuditoria('email_confirmacao_recusada', idExterno, contexto, {
      motivo: 'codigo_incorreto',
      tentativas,
      restantes: Math.max(0, LIMITE_TENTATIVAS_CODIGO - tentativas),
    });
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
      `lcr:rate:codigo_verificacao:ip:${origem}`,
      LIMITE_CONFIRMACOES_POR_ORIGEM,
      JANELA_CONFIRMACOES_SEGUNDOS,
    );
    this.exigirProtecaoDisponivel(resultado.disponivel);
    if (!resultado.permitido) this.erro(codigoGrpc.RESOURCE_EXHAUSTED, 'Muitas tentativas desta origem. Aguarde alguns minutos.');
  }

  private exigirProtecaoDisponivel(disponivel: boolean): void {
    if (!disponivel) this.erro(codigoGrpc.UNAVAILABLE, 'Protecao contra abuso indisponivel');
  }

  private respostaNeutra(): RespostaSolicitacao {
    return {
      solicitacaoAceita: true,
      expiraEmSegundos: EXPIRACAO_VERIFICACAO_EMAIL_MINUTOS * 60,
      mensagemResultado: MENSAGEM_SOLICITACAO_NEUTRA,
      comprimentoCodigo: COMPRIMENTO_CODIGO_VERIFICACAO,
    };
  }

  private normalizarEmail(email: string): string {
    return (email ?? '').trim().toLowerCase();
  }

  private validarEmail(email: string): void {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) this.erro(codigoGrpc.INVALID_ARGUMENT, 'Email invalido');
  }

  private hashIdentificador(valor: string): string {
    return hashCodigoVerificacao(valor, 'identificador-rate-limit');
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
