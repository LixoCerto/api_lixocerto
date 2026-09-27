/** Regras dos fluxos de confirmação de e-mail e recuperação de senha. */
export const EXPIRACAO_VERIFICACAO_EMAIL_HORAS = 24;
export const EXPIRACAO_REDEFINICAO_SENHA_MINUTOS = 60;

/** Limite de tentativas inválidas antes de o token ser invalidado. */
export const LIMITE_TENTATIVAS_TOKEN = 5;

/** Janelas de rate limit (chave por identificador e por endereço de origem). */
export const LIMITE_SOLICITACOES_POR_IDENTIFICADOR = 3;
export const LIMITE_SOLICITACOES_POR_ORIGEM = 10;
export const JANELA_SOLICITACOES_SEGUNDOS = 900;

export const LIMITE_CONFIRMACOES_POR_ORIGEM = 20;
export const JANELA_CONFIRMACOES_SEGUNDOS = 900;

/**
 * Mensagem única para solicitações de e-mail.
 * Não revela se o endereço existe na base (proteção contra enumeração de contas).
 */
export const MENSAGEM_SOLICITACAO_NEUTRA =
  'Se o endereco informado estiver cadastrado, enviaremos as instrucoes por e-mail em instantes.';

export function expiracaoVerificacaoEmail(): Date {
  return new Date(Date.now() + EXPIRACAO_VERIFICACAO_EMAIL_HORAS * 60 * 60 * 1000);
}

export function expiracaoRedefinicaoSenha(): Date {
  return new Date(Date.now() + EXPIRACAO_REDEFINICAO_SENHA_MINUTOS * 60 * 1000);
}