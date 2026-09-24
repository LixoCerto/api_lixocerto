import { Module } from '@nestjs/common';
import { ControladorGrpcMateriais } from './materiais.controlador.grpc.js';
import { RepositorioMateriais } from './materiais.repositorio.js';
import { ServicoMateriais } from './materiais.servico.js';

@Module({
  controllers: [ControladorGrpcMateriais],
  providers: [RepositorioMateriais, ServicoMateriais],
  exports: [ServicoMateriais],
})
export class ModuloMateriais {}
