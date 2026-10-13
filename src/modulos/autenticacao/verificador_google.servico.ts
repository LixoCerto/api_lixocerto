import { status as codigoGrpc } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { OAuth2Client } from 'google-auth-library';
import type { IdentidadeGoogleVerificada } from './identidade_google.js';

@Injectable()
export class VerificadorGoogleServico {
  private readonly clienteGoogle = new OAuth2Client();

  async verificar(idTokenGoogle: string, nonceEsperado: string): Promise<IdentidadeGoogleVerificada> {
    if (!idTokenGoogle.trim() || !nonceEsperado.trim()) {
      this.erro(codigoGrpc.INVALID_ARGUMENT, 'Credencial Google invalida');
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    if (!clientId) {
      this.erro(codigoGrpc.FAILED_PRECONDITION, 'Login Google nao configurado');
    }

    let payload;
    try {
      const ticket = await this.clienteGoogle.verifyIdToken({
        idToken: idTokenGoogle,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      this.erro(codigoGrpc.UNAUTHENTICATED, 'Credencial Google invalida');
    }

    const email = payload?.email?.trim().toLowerCase() ?? '';
    if (
      !payload?.sub ||
      !email ||
      email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      payload.email_verified !== true ||
      payload.nonce !== nonceEsperado
    ) {
      this.erro(codigoGrpc.UNAUTHENTICATED, 'Credencial Google invalida');
    }

    const nome = payload.name?.trim() || email.split('@')[0] || 'usuario';
    return {
      sub: payload.sub,
      email,
      nome: nome.slice(0, 180),
      emailAutoritativo: email.endsWith('@gmail.com') || Boolean(payload.hd),
    };
  }

  private erro(codigo: number, mensagem: string): never {
    throw new RpcException({ code: codigo, message: mensagem });
  }
}
