import { Redis } from "ioredis";

function inteiro(nome: string, padrao: number): number {
  const valor = Number.parseInt(process.env[nome] ?? "", 10);
  return Number.isInteger(valor) && valor >= 0 ? valor : padrao;
}

export function criarConexaoRedis(): Redis | null {
  const host = process.env.REDIS_HOST;
  if (!host) return null;

  return new Redis({
    host,
    port: inteiro("REDIS_PORT", 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: inteiro("REDIS_DB", 0),
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });
}
