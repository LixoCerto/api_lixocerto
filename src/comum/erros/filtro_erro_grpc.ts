import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { registrarEvento } from '../observabilidade/registrador.js';

@Catch()
export class FiltroErroGrpc implements ExceptionFilter {
  catch(erro: unknown, _host: ArgumentsHost): void {
    const detalhe = erro instanceof RpcException ? erro.getError() : erro;
    const objeto = typeof detalhe === 'object' && detalhe !== null ? detalhe as Record<string, unknown> : {};
    registrarEvento('erro_grpc', {
      tipoErro: erro instanceof Error ? erro.name : 'erro_desconhecido',
      codigo: objeto.code ?? 'INTERNAL',
      mensagem: typeof objeto.message === 'string' ? objeto.message.slice(0, 300) : 'Erro interno',
    });
  }
}
