import { Module } from '@nestjs/common';
import { ModuloAutenticacao } from '../autenticacao/autenticacao.module.js';
import { ModuloIdentidade } from '../identidade/identidade.module.js';
import { ControladorGrpcPerfil } from './perfil.controlador.grpc.js';
import { ServicoPerfil } from './perfil.servico.js';

@Module({
  imports: [ModuloAutenticacao, ModuloIdentidade],
  controllers: [ControladorGrpcPerfil],
  providers: [ServicoPerfil],
  exports: [ServicoPerfil],
})
export class ModuloPerfil {}
