import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TAMANHO_TOKEN_BYTES = 32;

/** Gera um token opaco de uso único, seguro para transporte por link de e-mail. */
export function gerarTokenUsoUnico(): string {
  return randomBytes(TAMANHO_TOKEN_BYTES).toString('base64url');
}

/**
 * Deriva o identificador persistido do token.
 * Somente o hash é gravado no banco: o valor original nunca é recuperável a partir do banco.
 */
export function hashTokenUsoUnico(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Comparação em tempo constante para tokens já hasheados. */
export function hashTokensIguais(hashA: string, hashB: string): boolean {
  const a = Buffer.from(hashA, 'utf8');
  const b = Buffer.from(hashB, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** O token precisa ser opaco, longo e compatível com base64url. */
export function tokenUsoUnicoValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{43,88}$/.test(token);
}