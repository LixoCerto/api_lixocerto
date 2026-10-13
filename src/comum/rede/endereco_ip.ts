import { isIP } from 'node:net';

/**
 * Retorna um único endereço IP válido para persistência em PostgreSQL INET.
 * Prioriza o endereço emitido pelo Cloudflare e, na ausência dele, usa o
 * primeiro endereço válido das cadeias X-Forwarded-For/X-Real-IP.
 */
export function normalizarEnderecoIp(
  cloudflare?: string,
  xForwardedFor?: string,
  xRealIp?: string,
): string | undefined {
  const candidatos = [
    ...(cloudflare?.split(',') ?? []),
    ...(xForwardedFor?.split(',') ?? []),
    ...(xRealIp?.split(',') ?? []),
  ];

  return candidatos
    .map((candidato) => candidato.trim())
    .find((candidato) => candidato.length > 0 && isIP(candidato) !== 0);
}
