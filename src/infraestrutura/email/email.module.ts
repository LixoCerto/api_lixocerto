import { Module } from '@nestjs/common';
import { ServicoEmail } from './email.servico.js';

@Module({
  providers: [ServicoEmail],
  exports: [ServicoEmail],
})
export class ModuloEmail {}