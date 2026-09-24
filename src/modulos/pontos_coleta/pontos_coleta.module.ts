import { Module } from '@nestjs/common';
import { ControladorGrpcPontosColeta } from './pontos_coleta.controlador.grpc.js';
import { RepositorioPontosColeta } from './pontos_coleta.repositorio.js';
import { ServicoPontosColeta } from './pontos_coleta.servico.js';

@Module({
  controllers: [ControladorGrpcPontosColeta],
  providers: [RepositorioPontosColeta, ServicoPontosColeta],
  exports: [ServicoPontosColeta],
})
export class ModuloPontosColeta {}
