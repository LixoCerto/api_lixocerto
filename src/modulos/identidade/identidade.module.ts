import { Module } from '@nestjs/common';
import { ModuloAutenticacao } from '../autenticacao/autenticacao.module.js';
import { ControladorGrpcIdentidade } from './identidade.controlador.grpc.js';
import { ServicoIdentidade } from './identidade.servico.js';

@Module({
  imports: [ModuloAutenticacao],
  controllers: [ControladorGrpcIdentidade],
  providers: [ServicoIdentidade],
  exports: [ServicoIdentidade],
})
export class ModuloIdentidade {}
