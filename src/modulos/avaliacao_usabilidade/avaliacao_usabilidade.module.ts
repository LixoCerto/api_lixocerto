import { Module } from '@nestjs/common';
import { ModuloAutenticacao } from '../autenticacao/autenticacao.module.js';
import { ModuloAutorizacao } from '../autorizacao/autorizacao.module.js';
import { ControladorGrpcAvaliacaoUsabilidade } from './avaliacao_usabilidade.controlador.grpc.js';
import { RepositorioAvaliacaoUsabilidade } from './avaliacao_usabilidade.repositorio.js';
import { ServicoAvaliacaoUsabilidade } from './avaliacao_usabilidade.servico.js';

@Module({
  imports: [ModuloAutenticacao, ModuloAutorizacao],
  controllers: [ControladorGrpcAvaliacaoUsabilidade],
  providers: [RepositorioAvaliacaoUsabilidade, ServicoAvaliacaoUsabilidade],
  exports: [ServicoAvaliacaoUsabilidade],
})
export class ModuloAvaliacaoUsabilidade {}
