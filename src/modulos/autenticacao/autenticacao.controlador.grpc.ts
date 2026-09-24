import { Controller } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { GrpcMethod } from '@nestjs/microservices';
import { ServicoAutenticacao } from './autenticacao.servico.js';

@Controller()
export class ControladorGrpcAutenticacao {
  constructor(private readonly servico: ServicoAutenticacao) {}

  @GrpcMethod('ServicoAutenticacao', 'ObterIdentidadeAtual')
  async obterIdentidadeAtual(_requisicao: unknown, metadados: Metadata) {
    const valor = metadados.get('authorization')[0];
    const autorizacao = Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
    const identidade = await this.servico.obterIdentidadeAtual(autorizacao);

    return {
      id_usuario: identidade.idExterno,
      nome_usuario: identidade.nome,
      email_usuario: identidade.email,
      papeis_usuario: identidade.papeis,
      permissoes_usuario: identidade.permissoes,
    };
  }
}
