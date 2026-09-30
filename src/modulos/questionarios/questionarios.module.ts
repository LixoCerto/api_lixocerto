import { Module } from '@nestjs/common';
import { ModuloAutenticacao } from '../autenticacao/autenticacao.module.js';
import { ModuloAutorizacao } from '../autorizacao/autorizacao.module.js';
import { ModuloAuditoria } from '../auditoria/auditoria.module.js';
import { ModuloGamificacao } from '../gamificacao/gamificacao.module.js';
import { ModuloDesafios } from '../desafios/desafios.module.js';
import { ModuloUsuarios } from '../usuarios/usuarios.module.js';
import { ControladorGrpcQuestionarios } from './questionarios.controlador.grpc.js';
import { RepositorioQuestionarios } from './questionarios.repositorio.js';
import { ServicoQuestionarios } from './questionarios.servico.js';

@Module({
  imports: [ModuloAutenticacao, ModuloAutorizacao, ModuloAuditoria, ModuloUsuarios, ModuloGamificacao, ModuloDesafios],
  controllers: [ControladorGrpcQuestionarios],
  providers: [RepositorioQuestionarios, ServicoQuestionarios],
  exports: [ServicoQuestionarios],
})
export class ModuloQuestionarios {}
