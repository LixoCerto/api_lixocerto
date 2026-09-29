import { Module } from '@nestjs/common';
import { ModuloAutenticacao } from '../autenticacao/autenticacao.module.js';
import { ModuloAutorizacao } from '../autorizacao/autorizacao.module.js';
import { ModuloAuditoria } from '../auditoria/auditoria.module.js';
import { ModuloUsuarios } from '../usuarios/usuarios.module.js';
import { ControladorGrpcAdministracao } from './administracao.controlador.grpc.js';
import { ServicoAdministracao } from './administracao.servico.js';

@Module({
  imports: [ModuloAutenticacao, ModuloAutorizacao, ModuloAuditoria, ModuloUsuarios],
  controllers: [ControladorGrpcAdministracao],
  providers: [ServicoAdministracao],
  exports: [ServicoAdministracao],
})
export class ModuloAdministracao {}
