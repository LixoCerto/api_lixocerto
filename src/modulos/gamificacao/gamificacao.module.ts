import { Module } from '@nestjs/common';
import { ServicoGamificacao } from './gamificacao.servico.js';

@Module({
  providers: [ServicoGamificacao],
  exports: [ServicoGamificacao],
})
export class ModuloGamificacao {}
