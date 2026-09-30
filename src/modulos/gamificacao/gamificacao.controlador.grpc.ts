import { Metadata } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ServicoAutenticacao } from '../autenticacao/autenticacao.servico.js';
import { ServicoAutorizacao } from '../autorizacao/autorizacao.servico.js';
import { ServicoUsuarios } from '../usuarios/usuarios.servico.js';
import { ServicoGamificacao } from './gamificacao.servico.js';

@Controller()
export class ControladorGrpcGamificacao {
  constructor(
    private readonly servico: ServicoGamificacao,
    private readonly autenticacao: ServicoAutenticacao,
    private readonly autorizacao: ServicoAutorizacao,
    private readonly usuarios: ServicoUsuarios,
  ) {}

  @GrpcMethod('ServicoGamificacao', 'ObterProgressoUsuario')
  async obterProgressoUsuario(_requisicao: unknown, metadados: Metadata) {
    const identidade = await this.obterIdentidade(metadados);
    this.autorizacao.exigirPermissao(identidade, 'gamificacao:ler');
    const idUsuario = await this.usuarios.obterIdInterno(identidade.idExterno);
    if (!idUsuario) throw new Error('Usuário autenticado sem registro interno');

    const progresso = await this.servico.obterProgresso(idUsuario);
    return {
      quantidade_pontos: progresso.quantidadePontos,
      nivel_gamificacao: progresso.nivelGamificacao,
      sequencia_dias: progresso.sequenciaDias,
      quantidade_conquistas: progresso.quantidadeConquistas,
    };
  }

  @GrpcMethod('ServicoGamificacao', 'ObterRanking')
  async obterRanking(requisicao: { limite_resultado?: number }, metadados: Metadata) {
    const identidade = await this.obterIdentidade(metadados);
    this.autorizacao.exigirPermissao(identidade, 'gamificacao:ler');
    const itens = await this.servico.obterRanking(requisicao.limite_resultado);
    return {
      itens_ranking: itens.map(item => ({
        posicao_ranking: item.posicaoRanking,
        nome_usuario: item.nomeUsuario,
        quantidade_pontos: item.quantidadePontos,
        nivel_gamificacao: item.nivelGamificacao,
      })),
    };
  }

  private async obterIdentidade(metadados: Metadata) {
    const valor = metadados.get('authorization')[0];
    const autorizacao = Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
    return this.autenticacao.obterIdentidadeAtual(autorizacao);
  }
}
