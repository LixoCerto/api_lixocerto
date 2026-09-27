/** Regras dos fluxos de confirmação de e-mail e recuperação de senha. */
export const EXPIRACAO_VERIFICACAO_EMAIL_MINUTOS = 15;
export const EXPIRACAO_REDEFINICAO_SENHA_MINUTOS = 15;

/** Quantidade de caracteres do código enviado por e-mail. */
export const COMPRIMENTO_CODIGO_VERIFICACAO = 6;

/**
 * Limite de tentativas inválidas antes de o código ser invalidado.
 *
 * Com 6 caracteres o espaço de busca é de 887 milhões de combinações; cinco
 * tentativas deixam a chance de acerto ao acaso em aproximadamente 0,0000006%.
 */
export const LIMITE_TENTATIVAS_CODIGO = 5;

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
  'Se o endereco informado estiver cadastrado, enviaremos um codigo de verificacao por e-mail em instantes.';

/** Mensagem devolvida quando as credenciais estão corretas mas o e-mail não foi confirmado. */
export const MENSAGEM_EMAIL_NAO_CONFIRMADO =
  'Confirme seu e-mail para continuar. Enviamos um codigo de verificacao para o endereco cadastrado.';

export function expiracaoVerificacaoEmail(): Date {
  return new Date(Date.now() + EXPIRACAO_VERIFICACAO_EMAIL_MINUTOS * 60 * 1000);
}

export function expiracaoRedefinicaoSenha(): Date {
  return new Date(Date.now() + EXPIRACAO_REDEFINICAO_SENHA_MINUTOS * 60 * 1000);
}