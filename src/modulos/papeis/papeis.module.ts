import { Module } from '@nestjs/common';
import { ServicoPapeis } from './papeis.servico.js';

@Module({
  providers: [ServicoPapeis],
  exports: [ServicoPapeis],
})
export class ModuloPapeis {}
