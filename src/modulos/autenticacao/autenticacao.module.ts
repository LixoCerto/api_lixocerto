import { Module } from '@nestjs/common';
import { ModuloUsuarios } from '../usuarios/usuarios.module.js';
import { ControladorGrpcAutenticacao } from './autenticacao.controlador.grpc.js';
import { ServicoAutenticacao } from './autenticacao.servico.js';
import { VerificadorJwtServico } from './verificador_jwt.servico.js';

@Module({
  imports: [ModuloUsuarios],
  controllers: [ControladorGrpcAutenticacao],
  providers: [VerificadorJwtServico, ServicoAutenticacao],
  exports: [ServicoAutenticacao, VerificadorJwtServico],
})
export class ModuloAutenticacao {}
