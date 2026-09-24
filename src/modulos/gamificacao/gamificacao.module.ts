import { Module } from '@nestjs/common';
import { ModuloUsuarios } from '../usuarios/usuarios.module.js';
import { ControladorGrpcGamificacao } from './gamificacao.controlador.grpc.js';
import { RepositorioProgresso } from './progresso.repositorio.js';
import { ServicoGamificacao } from './gamificacao.servico.js';

@Module({
  imports: [ModuloUsuarios],
  controllers: [ControladorGrpcGamificacao],
  providers: [RepositorioProgresso, ServicoGamificacao],
  exports: [ServicoGamificacao],
})
export class ModuloGamificacao {}
