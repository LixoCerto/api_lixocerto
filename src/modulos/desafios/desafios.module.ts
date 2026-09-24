import { Module } from '@nestjs/common';
import { ModuloAutenticacao } from '../autenticacao/autenticacao.module.js';
import { ModuloAuditoria } from '../auditoria/auditoria.module.js';
import { ModuloGamificacao } from '../gamificacao/gamificacao.module.js';
import { ModuloUsuarios } from '../usuarios/usuarios.module.js';
import { ControladorGrpcDesafios } from './desafios.controlador.grpc.js';
import { RepositorioDesafios } from './desafios.repositorio.js';
import { ServicoDesafios } from './desafios.servico.js';

@Module({
  imports: [ModuloAutenticacao, ModuloAuditoria, ModuloGamificacao, ModuloUsuarios],
  controllers: [ControladorGrpcDesafios],
  providers: [RepositorioDesafios, ServicoDesafios],
  exports: [ServicoDesafios],
})
export class ModuloDesafios {}
