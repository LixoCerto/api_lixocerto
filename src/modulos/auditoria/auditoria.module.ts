import { Module } from '@nestjs/common';
import { ModuloAutenticacao } from '../autenticacao/autenticacao.module.js';
import { ModuloAutorizacao } from '../autorizacao/autorizacao.module.js';
import { ModuloUsuarios } from '../usuarios/usuarios.module.js';
import { ControladorGrpcAuditoria } from './auditoria.controlador.grpc.js';
import { RepositorioAuditoria } from './auditoria.repositorio.js';
import { ServicoAuditoria } from './auditoria.servico.js';

@Module({
  imports: [ModuloAutenticacao, ModuloAutorizacao, ModuloUsuarios],
  controllers: [ControladorGrpcAuditoria],
  providers: [RepositorioAuditoria, ServicoAuditoria],
  exports: [ServicoAuditoria],
})
export class ModuloAuditoria {}
