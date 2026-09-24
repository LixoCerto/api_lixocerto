import { Module } from '@nestjs/common';
import { ServicoPermissoes } from './permissoes.servico.js';

@Module({
  providers: [ServicoPermissoes],
  exports: [ServicoPermissoes],
})
export class ModuloPermissoes {}
