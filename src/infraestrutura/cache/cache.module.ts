import { Global, Module } from '@nestjs/common';
import { criarConexaoRedis } from './conexao_redis.js';
import { ServicoCache } from './cache.servico.js';

@Global()
@Module({
  providers: [
    { provide: 'CONEXAO_REDIS', useFactory: criarConexaoRedis },
    ServicoCache,
  ],
  exports: ['CONEXAO_REDIS', ServicoCache],
})
export class ModuloCache {}
