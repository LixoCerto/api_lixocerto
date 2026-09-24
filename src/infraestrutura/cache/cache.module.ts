import { Global, Module } from '@nestjs/common';
import { criarConexaoRedis } from './conexao_redis.js';
import { ServicoCache } from './cache.servico.js';
import { ServicoRateLimit } from './rate_limit.servico.js';

@Global()
@Module({
  providers: [
    { provide: 'CONEXAO_REDIS', useFactory: criarConexaoRedis },
    ServicoCache,
    ServicoRateLimit,
  ],
  exports: ['CONEXAO_REDIS', ServicoCache, ServicoRateLimit],
})
export class ModuloCache {}
