import { Controller } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { GrpcMethod } from '@nestjs/microservices';
import { ServicoAutenticacao } from '../autenticacao/autenticacao.servico.js';
import { SessaoResumo, ServicoSessoes } from './sessoes.servico.js';

@Controller()
export class ControladorGrpcSessoes {
  constructor(
    private readonly autenticacao: ServicoAutenticacao,
    private readonly servico: ServicoSessoes,
  ) {}

  private async obterIdExterno(metadados: Metadata): Promise<string> {
    const valor = metadados.get('authorization')[0];
    const autorizacao = Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
    const identidade = await this.autenticacao.obterIdentidadeAtual(autorizacao);
    return identidade.idExterno;
  }

  private mapear(sessao: SessaoResumo, idSessaoAtual?: string) {
    return {
      id_sessao: sessao.idSessao,
      endereco_ip: sessao.enderecoIp ?? '',
      agente_usuario: sessao.agenteUsuario ?? '',
      data_expiracao: sessao.dataExpiracao.toISOString(),
      data_revogacao: sessao.dataRevogacao?.toISOString() ?? '',
      data_criacao: sessao.dataCriacao.toISOString(),
      atual: sessao.idSessao === idSessaoAtual,
    };
  }

  @GrpcMethod('ServicoSessoes', 'ListarSessoes')
  async listarSessoes(_requisicao: unknown, metadados: Metadata) {
    const idExterno = await this.obterIdExterno(metadados);
    const idSessaoAtual = metadados.get('x-id-sessao')[0];
    const sessoes = await this.servico.listar(idExterno);
    return { sessoes: sessoes.map(sessao => this.mapear(sessao, typeof idSessaoAtual === 'string' ? idSessaoAtual : undefined)) };
  }

  @GrpcMethod('ServicoSessoes', 'RevogarSessao')
  async revogarSessao(requisicao: { id_sessao?: string }, metadados: Metadata) {
    const idExterno = await this.obterIdExterno(metadados);
    return { sessao_revogada: await this.servico.revogar(idExterno, requisicao.id_sessao ?? '') };
  }

  @GrpcMethod('ServicoSessoes', 'RevogarTodasSessoes')
  async revogarTodasSessoes(_requisicao: unknown, metadados: Metadata) {
    const idExterno = await this.obterIdExterno(metadados);
    return { quantidade_revogada: await this.servico.revogarTodas(idExterno) };
  }
}
