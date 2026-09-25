import { status as codigoGrpc } from '@grpc/grpc-js';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { registrarEvento } from '../observabilidade/registrador.js';

function mapearCodigoHttp(statusHttp: number): number {
  const mapa: Record<number, number> = {
    400: codigoGrpc.INVALID_ARGUMENT,
    401: codigoGrpc.UNAUTHENTICATED,
    403: codigoGrpc.PERMISSION_DENIED,
    404: codigoGrpc.NOT_FOUND,
    409: codigoGrpc.ALREADY_EXISTS,
    408: codigoGrpc.DEADLINE_EXCEEDED,
    429: codigoGrpc.RESOURCE_EXHAUSTED,
    501: codigoGrpc.UNIMPLEMENTED,
    503: codigoGrpc.UNAVAILABLE,
  };
  return mapa[statusHttp] ?? codigoGrpc.INTERNAL;
}

function extrairDetalhe(erro: unknown): Record<string, unknown> {
  const detalhe = erro instanceof RpcException ? erro.getError() : erro;
  return typeof detalhe === 'object' && detalhe !== null ? detalhe as Record<string, unknown> : {};
}

export function mapearCodigoErroGrpc(erro: unknown): number {
  const detalhe = extrairDetalhe(erro);
  if (typeof detalhe.code === 'number') return detalhe.code;
  if (erro instanceof HttpException) return mapearCodigoHttp(erro.getStatus());
  return codigoGrpc.INTERNAL;
}

export function mapearMensagemErroGrpc(erro: unknown): string {
  const detalhe = erro instanceof RpcException ? erro.getError() : erro;
  if (typeof detalhe === 'string' && detalhe.trim()) return detalhe.slice(0, 300);
  if (typeof detalhe === 'object' && detalhe !== null && typeof (detalhe as Record<string, unknown>).message === 'string') {
    return ((detalhe as Record<string, unknown>).message as string).slice(0, 300);
  }
  if (erro instanceof HttpException) {
    const resposta = erro.getResponse();
    if (typeof resposta === 'string' && resposta.trim()) return resposta.slice(0, 300);
    if (typeof resposta === 'object' && resposta !== null && typeof (resposta as Record<string, unknown>).message === 'string') {
      return ((resposta as Record<string, unknown>).message as string).slice(0, 300);
    }
  }
  return 'Erro interno';
}

@Catch()
export class FiltroErroGrpc implements ExceptionFilter {
  catch(erro: unknown, _host: ArgumentsHost): Observable<never> {
    const codigo = mapearCodigoErroGrpc(erro);
    const mensagem = mapearMensagemErroGrpc(erro);
    registrarEvento('erro_grpc', {
      tipoErro: erro instanceof Error ? erro.name : 'erro_desconhecido',
      codigo,
      mensagem,
    });

    return throwError(() => ({
      code: codigo,
      details: mensagem,
      message: mensagem,
    }));
  }
}
