import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Alfabeto do código de verificação: 31 caracteres.
 *
 * Sem vogais (evita a formação de palavras ofensivas por acaso) e sem os
 * caracteres ambíguos I, L, O, 0 e 1, que são confundidos com facilidade
 * quando o usuário lê o código no e-mail e digita no aplicativo.
 */
export const ALFABETO_CODIGO = '23456789BCDFGHJKMNPQRSTVWXYZ';

/** Comprimento do código entregue por e-mail. */
export const COMPRIMENTO_CODIGO = 6;

/** Espaço de busca: 28^6 = 481.890.304 combinações. */
const TOTAL_POSSIBILIDADES = ALFABETO_CODIGO.length ** COMPRIMENTO_CODIGO;

const SEGREDO_DOMINIO = 'lcr:codigo-verificacao-email:v1';

/**
 * Gera um código legível usando aleatoriedade criptográfica.
 * `randomInt` é usado no lugar de `Math.random` para evitar previsibilidade.
 */
export function gerarCodigoVerificacao(): string {
  let codigo = '';
  for (let posicao = 0; posicao < COMPRIMENTO_CODIGO; posicao += 1) {
    codigo += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  }
  return codigo;
}

/**
 * Normaliza a entrada do usuário: remove espaços, hífens e caixa.
 * O usuário pode digitar "ab3-9kz" ou "AB39KZ" e o valor é aceito igualmente.
 */
export function normalizarCodigoVerificacao(codigo: string): string {
  return (codigo ?? '').replace(/[\s-]/g, '').toUpperCase();
}

/** Aceita somente códigos com o comprimento e o alfabeto esperados. */
export function codigoVerificacaoValido(codigo: string): boolean {
  if (codigo.length !== COMPRIMENTO_CODIGO) return false;
  for (const caractere of codigo) {
    if (!ALFABETO_CODIGO.includes(caractere)) return false;
  }
  return true;
}

/**
 * Expressão regular que reconhece exatamente um código do alfabeto atual.
 * Derivada de `ALFABETO_CODIGO` para que ferramentas e testes nunca fiquem
 * desalinhados caso o alfabeto mude.
 */
export function expressaoCodigoVerificacao(): RegExp {
  const escapado = ALFABETO_CODIGO.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
  return new RegExp(`\\b[${escapado}]{${COMPRIMENTO_CODIGO}}\\b`);
}

/**
 * Chave de derivação do hash, isolada por domínio.
 *
 * O valor preferencial é `SEGREDO_CODIGO_EMAIL`. Quando ausente, deriva-se uma
 * subchave de `SEGREDO_JWT` com separação de domínio, para não reutilizar o
 * mesmo material de chave em duas finalidades distintas.
 */
function obterChave(): Buffer {
  const dedicado = process.env.SEGREDO_CODIGO_EMAIL?.trim();
  if (dedicado && dedicado.length >= 32) {
    return createHmac('sha256', SEGREDO_DOMINIO).update(dedicado, 'utf8').digest();
  }
  const base = process.env.SEGREDO_JWT?.trim();
  if (!base || base.length < 32) {
    throw new Error('Segredo para codigo de verificacao nao configurado');
  }
  return createHmac('sha256', SEGREDO_DOMINIO).update(base, 'utf8').digest();
}

/**
 * Deriva o identificador persistido do código.
 *
 * Como o código tem apenas 6 caracteres, um hash simples seria reversível por
 * força bruta a partir do banco. O HMAC com chave secreta garante que o dump do
 * banco, sozinho, não permita descobrir o código de nenhum usuário.
 *
 * O tipo entra na mensagem para que os fluxos de confirmação de e-mail e de
 * redefinição de senha não compartilhem o mesmo identificador.
 */
export function hashCodigoVerificacao(codigo: string, tipo: string): string {
  return createHmac('sha256', obterChave()).update(`${tipo}:${codigo}`, 'utf8').digest('hex');
}

/** Comparação em tempo constante, usada quando os hashes já foram derivados. */
export function hashesIguais(hashA: string, hashB: string): boolean {
  const a = Buffer.from(hashA, 'utf8');
  const b = Buffer.from(hashB, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Probabilidade de colisão com `quantidadeAtiva` códigos pendentes.
 * Usada apenas para documentar o risco; a colisão real é tratada por retentativa.
 */
export function probabilidadeColisao(quantidadeAtiva: number): number {
  return quantidadeAtiva / TOTAL_POSSIBILIDADES;
}

/** Quantidade máxima de tentativas de geração antes de desistir. */
export const TENTATIVAS_GERACAO_CODIGO = 5;
