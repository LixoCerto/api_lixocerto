import { Controller } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { GrpcMethod } from '@nestjs/microservices';
import { ServicoAutenticacao } from '../autenticacao/autenticacao.servico.js';
import { PerfilAtual, ServicoPerfil } from './perfil.servico.js';

@Controller()
export class ControladorGrpcPerfil {
  constructor(
    private readonly autenticacao: ServicoAutenticacao,
    private readonly servico: ServicoPerfil,
  ) {}

  private async obterIdentidade(metadados: Metadata) {
    const valor = metadados.get('authorization')[0];
    const autorizacao = Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
    return this.autenticacao.obterIdentidadeAtual(autorizacao);
  }

  private mapear(perfil: PerfilAtual) {
    return {
      id_usuario: perfil.idUsuario,
      id_externo: perfil.idExterno,
      nome_usuario: perfil.nome,
      email_usuario: perfil.email,
      status_usuario: perfil.status,
      papeis_usuario: perfil.papeis,
      permissoes_usuario: perfil.permissoes,
    };
  }

  @GrpcMethod('ServicoPerfil', 'ObterPerfilAtual')
  async obterPerfilAtual(_requisicao: unknown, metadados: Metadata) {
    const identidade = await this.obterIdentidade(metadados);
    const perfil = await this.servico.obter(identidade.idExterno, identidade.papeis, identidade.permissoes);
    return this.mapear(perfil);
  }

  @GrpcMethod('ServicoPerfil', 'AtualizarPerfil')
  async atualizarPerfil(requisicao: { nome_usuario?: string }, metadados: Metadata) {
    const identidade = await this.obterIdentidade(metadados);
    const perfil = await this.servico.atualizarNome(identidade.idExterno, requisicao.nome_usuario ?? '', identidade.papeis, identidade.permissoes);
    return { perfil_atualizado: true, perfil: this.mapear(perfil) };
  }
}
