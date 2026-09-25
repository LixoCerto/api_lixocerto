import { status } from '@grpc/grpc-js';
import { UnauthorizedException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { describe, expect, it } from 'vitest';
import { mapearCodigoErroGrpc, mapearMensagemErroGrpc } from '../../src/comum/erros/filtro_erro_grpc.js';

describe('mapeamento de erros gRPC', () => {
  it('converte ausência de autenticação para UNAUTHENTICATED', () => {
    const erro = new UnauthorizedException('Cabecalho de autorizacao ausente');

    expect(mapearCodigoErroGrpc(erro)).toBe(status.UNAUTHENTICATED);
    expect(mapearMensagemErroGrpc(erro)).toContain('Cabecalho');
  });

  it('preserva o código explícito de uma RpcException', () => {
    const erro = new RpcException({ code: status.RESOURCE_EXHAUSTED, message: 'Limite excedido' });

    expect(mapearCodigoErroGrpc(erro)).toBe(status.RESOURCE_EXHAUSTED);
    expect(mapearMensagemErroGrpc(erro)).toBe('Limite excedido');
  });
});
