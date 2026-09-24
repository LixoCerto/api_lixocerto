import { Module } from '@nestjs/common';
import { ControladorGrpcSaude } from './saude.controlador.grpc.js';

@Module({ controllers: [ControladorGrpcSaude] })
export class ModuloSaude {}
