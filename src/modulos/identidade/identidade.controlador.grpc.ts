import { Controller } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { GrpcMethod } from '@nestjs/microservices';
import { ServicoAutenticacao } from '../autenticacao/autenticacao.servico.js';
import { ServicoIdentidade } from './identidade.servico.js';

@Controller()
export class ControladorGrpcIdentidade {
  constructor(
    private readonly autenticacao: ServicoAutenticacao,
    private readonly servico: ServicoIdentidade,
  ) {}

  @GrpcMethod('ServicoIdentidade', 'ObterIdentidadeInterna')
  async obterIdentidadeInterna(_requisicao: unknown, metadados: Metadata): Promise<{
    id_usuario: string;
    id_externo: string;
    nome_usuario: string;
    email_usuario: string;
    status_usuario: string;
  }> {
    const valor = metadados.get('authorization')[0];
    const autorizacao = Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
    const identidadeExterna = await this.autenticacao.obterIdentidadeAtual(autorizacao);
    const identidade = await this.servico.exigirAtivo(identidadeExterna.idExterno);
    return {
      id_usuario: identidade.idUsuario,
      id_externo: identidade.idExterno,
      nome_usuario: identidade.nome,
      email_usuario: identidade.email,
      status_usuario: identidade.status,
    };
  }
}
