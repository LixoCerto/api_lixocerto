import { Module } from '@nestjs/common';
import { ModuloAutenticacao } from '../autenticacao/autenticacao.module.js';
import { ModuloAutorizacao } from '../autorizacao/autorizacao.module.js';
import { ModuloAuditoria } from '../auditoria/auditoria.module.js';
import { ModuloUsuarios } from '../usuarios/usuarios.module.js';
import { ModuloGamificacao } from '../gamificacao/gamificacao.module.js';
import { ModuloDesafios } from '../desafios/desafios.module.js';
import { ControladorGrpcPontosColeta } from './pontos_coleta.controlador.grpc.js';
import { RepositorioDescartes } from './descartes.repositorio.js';
import { ServicoDescartes } from './descartes.servico.js';
import { RepositorioPontosColeta } from './pontos_coleta.repositorio.js';
import { ServicoPontosColeta } from './pontos_coleta.servico.js';
import { GeocodificacaoReversa } from './geocodificacao_reversa.servico.js';
import { ArmazenamentoEvidenciasDescartes } from './armazenamento_evidencias_descartes.servico.js';

@Module({
  imports: [ModuloAutenticacao, ModuloAutorizacao, ModuloAuditoria, ModuloUsuarios, ModuloGamificacao, ModuloDesafios],
  controllers: [ControladorGrpcPontosColeta],
  providers: [RepositorioPontosColeta, ServicoPontosColeta, GeocodificacaoReversa, RepositorioDescartes, ArmazenamentoEvidenciasDescartes, ServicoDescartes],
  exports: [ServicoPontosColeta],
})
export class ModuloPontosColeta {}
