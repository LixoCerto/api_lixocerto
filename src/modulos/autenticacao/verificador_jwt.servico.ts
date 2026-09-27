import { randomBytes } from 'node:crypto';
import { status as codigoGrpc } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { jwtVerify, SignJWT, JWTPayload } from 'jose';
import { UsuarioAutenticado } from '../../comum/autenticacao/usuario_autenticado.js';

interface DadosToken extends JWTPayload {
  nome?: string;
  email?: string;
  papeis?: unknown;
  permissoes?: unknown;
  tipo?: string;
}

export const EXPIRACAO_TOKEN_ACESSO_SEGUNDOS = 900;
export const EXPIRACAO_TOKEN_ATUALIZACAO_DIAS = 30;

@Injectable()
export class VerificadorJwtServico {
  async assinarTokenAcesso(identidade: UsuarioAutenticado): Promise<string> {
    const agora = Math.floor(Date.now() / 1000);
    return new SignJWT({
      nome: identidade.nome,
      email: identidade.email,
      papeis: identidade.papeis,
      permissoes: identidade.permissoes,
      tipo: 'acesso',
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(identidade.idExterno)
      .setIssuer(this.obterEmissor())
      .setAudience(this.obterAudiencia())
      .setIssuedAt(agora)
      .setExpirationTime(agora + EXPIRACAO_TOKEN_ACESSO_SEGUNDOS)
      .setJti(randomBytes(16).toString('hex'))
      .sign(this.obterSegredo());
  }

  criarTokenAtualizacao(): string {
    return randomBytes(48).toString('base64url');
  }

  async verificar(token: string): Promise<UsuarioAutenticado> {
    try {
      const resultado = await jwtVerify<DadosToken>(token, this.obterSegredo(), {
        issuer: this.obterEmissor(),
        audience: this.obterAudiencia(),
        algorithms: ['HS256'],
      });
      const payload = resultado.payload;
      if (payload.tipo !== 'acesso' || typeof payload.sub !== 'string' || !payload.sub.trim()) {
        throw new Error('Tipo de token invalido');
      }
      if (typeof payload.email !== 'string' || !payload.email.trim()) {
        throw new Error('Identidade do token ausente');
      }
      return {
        idExterno: payload.sub,
        nome: this.obterNome(payload),
        email: payload.email.trim().toLowerCase(),
        papeis: this.obterLista(payload.papeis),
        permissoes: this.obterLista(payload.permissoes),
      };
    } catch {
      throw new RpcException({ code: codigoGrpc.UNAUTHENTICATED, message: 'Token invalido ou expirado' });
    }
  }

  extrairToken(valorAutorizacao: string | undefined): string {
    const correspondencia = valorAutorizacao?.match(/^Bearer\s+(.+)$/i);
    if (!correspondencia?.[1]) {
      throw new RpcException({ code: codigoGrpc.UNAUTHENTICATED, message: 'Cabecalho de autorizacao ausente' });
    }
    return correspondencia[1];
  }

  private obterSegredo(): Uint8Array {
    const segredo = process.env.SEGREDO_JWT?.trim();
    if (!segredo || segredo.length < 32) {
      throw new RpcException({ code: codigoGrpc.INTERNAL, message: 'Segredo JWT nao configurado' });
    }
    return new TextEncoder().encode(segredo);
  }

  private obterEmissor(): string {
    return process.env.EMISSOR_JWT?.trim() || 'lixo-certo-api';
  }

  private obterAudiencia(): string {
    return process.env.AUDIENCIA_JWT?.trim() || 'lixo-certo-client';
  }

  private obterNome(payload: DadosToken): string {
    return typeof payload.nome === 'string' && payload.nome.trim() ? payload.nome.trim() : payload.email!.trim();
  }

  private obterLista(valor: unknown): string[] {
    return Array.isArray(valor)
      ? [...new Set(valor.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))]
      : [];
  }
}
