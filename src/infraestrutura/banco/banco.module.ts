import { Global, Module } from '@nestjs/common';
import { criarConexaoBanco } from './conexao.js';

@Global()
@Module({
  providers: [
    {
      provide: 'CONEXAO_BANCO_DADOS',
      useFactory: criarConexaoBanco,
    },
  ],
  exports: ['CONEXAO_BANCO_DADOS'],
})
export class ModuloBancoDados {}
