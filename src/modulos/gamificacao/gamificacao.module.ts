import { Module } from '@nestjs/common';
import { ModuloAutenticacao } from '../autenticacao/autenticacao.module.js';
import { ModuloAutorizacao } from '../autorizacao/autorizacao.module.js';
import { ModuloUsuarios } from '../usuarios/usuarios.module.js';
import { ControladorGrpcGamificacao } from './gamificacao.controlador.grpc.js';
import { RepositorioProgresso } from './progresso.repositorio.js';
import { ServicoGamificacao } from './gamificacao.servico.js';

@Module({
  imports: [ModuloAutenticacao, ModuloAutorizacao, ModuloUsuarios],
  controllers: [ControladorGrpcGamificacao],
  providers: [RepositorioProgresso, ServicoGamificacao],
  exports: [ServicoGamificacao],
})
export class ModuloGamificacao {}
