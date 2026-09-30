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
  async obterProgressoUsuario(_requisicao: unknown, metadados: Metadata): Promise<{
    quantidade_pontos: number;
    nivel_gamificacao: string;
    sequencia_dias: number;
    quantidade_conquistas: number;
    selos: Array<{ codigo: string; nome: string; descricao: string; pontos_minimos: number; icone: string; conquistado: boolean; data_conquista: string }>;
    resumo_por_origem: Array<{ origem: string; quantidade_pontos: number; quantidade_eventos: number }>;
  }> {
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
      selos: progresso.selos.map(selo => ({
        codigo: selo.codigo,
        nome: selo.nome,
        descricao: selo.descricao,
        pontos_minimos: selo.pontosMinimos,
        icone: selo.icone,
        conquistado: selo.conquistado,
        data_conquista: selo.dataConquista,
      })),
      resumo_por_origem: progresso.pontosPorOrigem.map(item => ({
        origem: item.origem,
        quantidade_pontos: item.quantidadePontos,
        quantidade_eventos: item.quantidadeEventos,
      })),
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
