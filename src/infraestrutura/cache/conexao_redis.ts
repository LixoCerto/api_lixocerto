import { Redis } from 'ioredis';

export function criarConexaoRedis(): Redis | null {
  const url = process.env.URL_REDIS;
  if (!url) return null;
  return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
}
