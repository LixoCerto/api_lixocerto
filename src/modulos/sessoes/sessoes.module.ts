import { Module } from '@nestjs/common';
import { ModuloAutenticacao } from '../autenticacao/autenticacao.module.js';
import { ModuloIdentidade } from '../identidade/identidade.module.js';
import { ControladorGrpcSessoes } from './sessoes.controlador.grpc.js';
import { ServicoSessoes } from './sessoes.servico.js';

@Module({
  imports: [ModuloAutenticacao, ModuloIdentidade],
  controllers: [ControladorGrpcSessoes],
  providers: [ServicoSessoes],
  exports: [ServicoSessoes],
})
export class ModuloSessoes {}
