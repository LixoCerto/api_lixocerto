import { Controller } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { GrpcMethod } from '@nestjs/microservices';
import { ServicoUsuarios } from '../usuarios/usuarios.servico.js';
import { ServicoGamificacao } from './gamificacao.servico.js';

@Controller()
export class ControladorGrpcGamificacao {
  constructor(
    private readonly servico: ServicoGamificacao,
    private readonly usuarios: ServicoUsuarios,
  ) {}

  @GrpcMethod('ServicoGamificacao', 'ObterProgressoUsuario')
  async obterProgressoUsuario(_requisicao: unknown, metadados: Metadata) {
    const idExterno = metadados.get('x-id-usuario-externo')[0];
    const idUsuario = typeof idExterno === 'string' ? await this.usuarios.obterIdInterno(idExterno) : null;
    if (!idUsuario) {
      return {
        quantidade_pontos: 0,
        nivel_gamificacao: 'iniciante',
        sequencia_dias: 0,
        quantidade_conquistas: 0,
      };
    }

    const progresso = await this.servico.obterProgresso(idUsuario);
    return {
      quantidade_pontos: progresso.quantidadePontos,
      nivel_gamificacao: progresso.nivelGamificacao,
      sequencia_dias: progresso.sequenciaDias,
      quantidade_conquistas: progresso.quantidadeConquistas,
    };
  }

  @GrpcMethod('ServicoGamificacao', 'ObterRanking')
  obterRanking() {
    return { itens_ranking: [] };
  }
}
