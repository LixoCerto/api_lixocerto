import { status as codigoGrpc } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { UsuarioAutenticado } from '../../comum/autenticacao/usuario_autenticado.js';
import { registrarEvento } from '../../comum/observabilidade/registrador.js';

const PAPEIS_PERMITIDOS = new Set(['usuario', 'pesquisador', 'revisor', 'administrador']);

type AcessoRealm = {
  roles?: unknown;
};

interface DadosToken extends JWTPayload {
  name?: string;
  nome?: string;
  email?: string;
  preferred_username?: string;
  papeis?: unknown;
  permissoes?: unknown;
  realm_access?: AcessoRealm;
}

@Injectable()
export class VerificadorJwtServico {
  private conjuntoChaves?: ReturnType<typeof createRemoteJWKSet>;
  private urlChaves?: string;

  async verificar(token: string): Promise<UsuarioAutenticado> {
    const emissor = process.env.EMISSOR_OIDC;
    const audiencia = process.env.AUDIENCIA_OIDC;
    const enderecoJwks = process.env.ENDERECO_JWKS;

    if (!emissor || !audiencia || !enderecoJwks) {
      throw new RpcException({ code: codigoGrpc.INTERNAL, message: 'Configuracao OIDC ausente' });
    }

    if (this.urlChaves !== enderecoJwks) {
      this.conjuntoChaves = createRemoteJWKSet(new URL(enderecoJwks));
      this.urlChaves = enderecoJwks;
    }

    try {
      const resultado = await jwtVerify<DadosToken>(token, this.conjuntoChaves!, {
        issuer: emissor,
        audience: audiencia,
        algorithms: ['RS256', 'ES256'],
      });
      const idExterno = resultado.payload.sub;
      const email = this.obterEmail(resultado.payload);
      if (!idExterno || !email) {
        throw new Error('Token sem identidade suficiente');
      }

      return {
        idExterno,
        nome: this.obterNome(resultado.payload),
        email,
        papeis: this.obterPapeis(resultado.payload),
        permissoes: this.obterLista(resultado.payload.permissoes),
      };
    } catch (erro) {
      if (process.env.AMBIENTE_EXECUCAO !== 'producao') {
        registrarEvento('falha_validacao_jwt', {
          motivo: erro instanceof Error ? erro.message : String(erro),
          emissor,
          audiencia,
          enderecoJwks,
        });
      }
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

  private obterNome(payload: DadosToken): string {
    if (typeof payload.nome === 'string' && payload.nome.trim()) return payload.nome;
    if (typeof payload.name === 'string' && payload.name.trim()) return payload.name;
    if (typeof payload.preferred_username === 'string' && payload.preferred_username.trim()) return payload.preferred_username;
    return payload.email!;
  }

  private obterEmail(payload: DadosToken): string | null {
    if (typeof payload.email === 'string' && payload.email.trim()) return payload.email.trim();

    const usuario = typeof payload.preferred_username === 'string' ? payload.preferred_username.trim() : '';
    const dominioDesenvolvimento = process.env.DOMINIO_EMAIL_OIDC_DESENVOLVIMENTO?.trim();
    if (process.env.AMBIENTE_EXECUCAO === 'desenvolvimento' && usuario && dominioDesenvolvimento) {
      return `${usuario}@${dominioDesenvolvimento}`;
    }

    return null;
  }

  private obterPapeis(payload: DadosToken): string[] {
    const papeisCustomizados = this.obterLista(payload.papeis);
    const papeisKeycloak = Array.isArray(payload.realm_access?.roles)
      ? payload.realm_access.roles.filter((papel): papel is string => typeof papel === 'string')
      : [];
    const papeis = [...papeisCustomizados, ...papeisKeycloak].filter(papel => PAPEIS_PERMITIDOS.has(papel));
    return [...new Set(papeis)].length ? [...new Set(papeis)] : ['usuario'];
  }

  private obterLista(valor: unknown): string[] {
    return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : [];
  }
}
