import { Global, Module } from '@nestjs/common';
import { criarConexaoRedis } from './conexao_redis.js';

@Global()
@Module({
  providers: [{ provide: 'CONEXAO_REDIS', useFactory: criarConexaoRedis }],
  exports: ['CONEXAO_REDIS'],
})
export class ModuloCache {}
