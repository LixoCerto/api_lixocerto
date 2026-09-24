import { Controller } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { GrpcMethod } from '@nestjs/microservices';
import { RpcException } from '@nestjs/microservices';
import { ServiceUnavailableException } from '@nestjs/common';
import { ServicoAutenticacao } from '../autenticacao/autenticacao.servico.js';
import { ServicoRateLimit } from '../../infraestrutura/cache/rate_limit.servico.js';
import { ServicoUsuarios } from '../usuarios/usuarios.servico.js';
import { ServicoDesafios } from './desafios.servico.js';

interface DesafioGrpc {
  id_desafio: string;
  nome_desafio: string;
  descricao_desafio: string;
  tipo_acao: string;
  meta_quantidade: number;
  quantidade_pontos: number;
  status_desafio: string;
  quantidade_progresso: number;
  status_participacao: string;
}

@Controller()
export class ControladorGrpcDesafios {
  constructor(
    private readonly servico: ServicoDesafios,
    private readonly autenticacao: ServicoAutenticacao,
    private readonly usuarios: ServicoUsuarios,
    private readonly rateLimit: ServicoRateLimit,
  ) {}

  private async obterUsuario(metadados: Metadata) {
    const valor = metadados.get('authorization')[0];
    const autorizacao = Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
    const identidade = await this.autenticacao.obterIdentidadeAtual(autorizacao);
    const idUsuario = await this.usuarios.obterIdInterno(identidade.idExterno);
    if (!idUsuario) throw new ServiceUnavailableException('Usuario autenticado sem registro interno');
    return idUsuario;
  }

  private async protegerMutacao(idUsuario: string, operacao: string, limite: number) {
    const resultado = await this.rateLimit.permitir(`lcr:rate:${operacao}:${idUsuario}`, limite, 60);
    if (!resultado.disponivel) throw new ServiceUnavailableException('Protecao contra abuso indisponivel');
    if (!resultado.permitido) throw new RpcException({ code: 8, message: 'Limite de operacoes excedido' });
  }

  private mapearDesafio(desafio: {
    idDesafio: string;
    nomeDesafio: string;
    descricaoDesafio: string;
    tipoAcao: string;
    metaQuantidade: number;
    quantidadePontos: number;
    statusDesafio: string;
    quantidadeProgresso: number;
    statusParticipacao: string;
  }): DesafioGrpc {
    return {
      id_desafio: desafio.idDesafio,
      nome_desafio: desafio.nomeDesafio,
      descricao_desafio: desafio.descricaoDesafio,
      tipo_acao: desafio.tipoAcao,
      meta_quantidade: desafio.metaQuantidade,
      quantidade_pontos: desafio.quantidadePontos,
      status_desafio: desafio.statusDesafio,
      quantidade_progresso: desafio.quantidadeProgresso,
      status_participacao: desafio.statusParticipacao,
    };
  }

  @GrpcMethod('ServicoDesafios', 'ListarDesafios')
  async listarDesafios(_requisicao: { numero_pagina?: number; tamanho_pagina?: number }, metadados: Metadata): Promise<{ desafios: DesafioGrpc[] }> {
    const idUsuario = await this.obterUsuario(metadados);
    const desafios = await this.servico.listar(idUsuario, _requisicao.numero_pagina, _requisicao.tamanho_pagina);
    return { desafios: desafios.map(desafio => this.mapearDesafio(desafio)) };
  }

  @GrpcMethod('ServicoDesafios', 'ParticiparDesafio')
  async participarDesafio(requisicao: { id_desafio?: string }, metadados: Metadata): Promise<{ participacao_aceita: boolean; desafio: Partial<DesafioGrpc>; mensagem_resultado: string }> {
    const idUsuario = await this.obterUsuario(metadados);
    await this.protegerMutacao(idUsuario, 'participar-desafio', 10);
    const desafio = await this.servico.participar(idUsuario, requisicao.id_desafio ?? '', this.obterCorrelacao(metadados));
    return desafio
      ? { participacao_aceita: true, desafio: this.mapearDesafio(desafio), mensagem_resultado: 'Participacao registrada.' }
      : { participacao_aceita: false, desafio: {}, mensagem_resultado: 'Desafio indisponivel.' };
  }

  @GrpcMethod('ServicoDesafios', 'RegistrarAcaoSustentavel')
  async registrarAcaoSustentavel(requisicao: { id_desafio?: string; tipo_acao?: string; descricao_acao?: string }, metadados: Metadata): Promise<{ acao_aceita: boolean; quantidade_pontos: number; quantidade_progresso: number; desafio_concluido: boolean; mensagem_resultado: string }> {
    const idUsuario = await this.obterUsuario(metadados);
    await this.protegerMutacao(idUsuario, 'registrar-acao', 20);
    const resultado = await this.servico.registrarAcao(idUsuario, {
      idDesafio: requisicao.id_desafio ?? '',
      tipoAcao: requisicao.tipo_acao ?? '',
      descricaoAcao: requisicao.descricao_acao ?? '',
    }, this.obterCorrelacao(metadados));
    return resultado
      ? {
        acao_aceita: true,
        quantidade_pontos: resultado.quantidadePontos,
        quantidade_progresso: resultado.quantidadeProgresso,
        desafio_concluido: resultado.desafioConcluido,
        mensagem_resultado: resultado.desafioConcluido ? 'Desafio concluido.' : 'Acao registrada.',
      }
      : { acao_aceita: false, quantidade_pontos: 0, quantidade_progresso: 0, desafio_concluido: false, mensagem_resultado: 'Acao ou participacao invalida.' };
  }

  private obterCorrelacao(metadados: Metadata): string {
    const valor = metadados.get('x-id-correlacao')[0];
    return typeof valor === 'string' && valor.trim() ? valor.slice(0, 120) : `grpc-${Date.now()}`;
  }
}
