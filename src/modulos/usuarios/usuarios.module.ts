import { Module } from '@nestjs/common';
import { ServicoUsuarios } from './usuarios.servico.js';

@Module({
  providers: [ServicoUsuarios],
  exports: [ServicoUsuarios],
})
export class ModuloUsuarios {}
