import { Module } from '@nestjs/common';
import { ControladorGrpcSaude } from './saude.controlador.grpc.js';
import { ServicoSaude } from './saude.servico.js';

@Module({ controllers: [ControladorGrpcSaude], providers: [ServicoSaude], exports: [ServicoSaude] })
export class ModuloSaude {}
