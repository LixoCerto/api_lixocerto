import { Module } from '@nestjs/common';
import { ServicoAutorizacao } from './autorizacao.servico.js';

@Module({
  providers: [ServicoAutorizacao],
  exports: [ServicoAutorizacao],
})
export class ModuloAutorizacao {}
