import { Module } from '@nestjs/common';
import { ModuloAutenticacao } from '../autenticacao/autenticacao.module.js';
import { ModuloAutorizacao } from '../autorizacao/autorizacao.module.js';
import { ModuloAuditoria } from '../auditoria/auditoria.module.js';
import { ModuloUsuarios } from '../usuarios/usuarios.module.js';
import { ControladorGrpcPontosColeta } from './pontos_coleta.controlador.grpc.js';
import { RepositorioPontosColeta } from './pontos_coleta.repositorio.js';
import { ServicoPontosColeta } from './pontos_coleta.servico.js';
import { GeocodificacaoReversa } from './geocodificacao_reversa.servico.js';

@Module({
  imports: [ModuloAutenticacao, ModuloAutorizacao, ModuloAuditoria, ModuloUsuarios],
  controllers: [ControladorGrpcPontosColeta],
  providers: [RepositorioPontosColeta, ServicoPontosColeta, GeocodificacaoReversa],
  exports: [ServicoPontosColeta],
})
export class ModuloPontosColeta {}
