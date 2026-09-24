import { Module } from '@nestjs/common';
import { ModuloGamificacao } from '../gamificacao/gamificacao.module.js';
import { ModuloUsuarios } from '../usuarios/usuarios.module.js';
import { ControladorGrpcQuestionarios } from './questionarios.controlador.grpc.js';
import { RepositorioQuestionarios } from './questionarios.repositorio.js';
import { ServicoQuestionarios } from './questionarios.servico.js';

@Module({
  imports: [ModuloUsuarios, ModuloGamificacao],
  controllers: [ControladorGrpcQuestionarios],
  providers: [RepositorioQuestionarios, ServicoQuestionarios],
  exports: [ServicoQuestionarios],
})
export class ModuloQuestionarios {}
