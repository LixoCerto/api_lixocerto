import { Module } from '@nestjs/common';
import { ModuloAutenticacao } from '../autenticacao/autenticacao.module.js';
import { ModuloAutorizacao } from '../autorizacao/autorizacao.module.js';
import { ModuloAuditoria } from '../auditoria/auditoria.module.js';
import { ModuloUsuarios } from '../usuarios/usuarios.module.js';
import { ControladorGrpcMateriais } from './materiais.controlador.grpc.js';
import { RepositorioMateriais } from './materiais.repositorio.js';
import { ServicoMateriais } from './materiais.servico.js';

@Module({
  imports: [ModuloAutenticacao, ModuloAutorizacao, ModuloAuditoria, ModuloUsuarios],
  controllers: [ControladorGrpcMateriais],
  providers: [RepositorioMateriais, ServicoMateriais],
  exports: [ServicoMateriais],
})
export class ModuloMateriais {}
