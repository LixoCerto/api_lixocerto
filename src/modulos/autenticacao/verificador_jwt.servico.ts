import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { UsuarioAutenticado } from '../../comum/autenticacao/usuario_autenticado.js';

interface DadosToken extends JWTPayload {
  nome?: string;
  email?: string;
  papeis?: string[];
  permissoes?: string[];
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
      throw new UnauthorizedException('Configuracao OIDC ausente');
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
      if (!idExterno || typeof resultado.payload.email !== 'string') {
        throw new UnauthorizedException('Token sem identidade suficiente');
      }

      return {
        idExterno,
        nome: typeof resultado.payload.nome === 'string' ? resultado.payload.nome : resultado.payload.email,
        email: resultado.payload.email,
        papeis: Array.isArray(resultado.payload.papeis) ? resultado.payload.papeis : ['usuario'],
        permissoes: Array.isArray(resultado.payload.permissoes) ? resultado.payload.permissoes : [],
      };
    } catch {
      throw new UnauthorizedException('Token invalido ou expirado');
    }
  }

  extrairToken(valorAutorizacao: string | undefined): string {
    const correspondencia = valorAutorizacao?.match(/^Bearer\s+(.+)$/i);
    if (!correspondencia?.[1]) {
      throw new UnauthorizedException('Cabecalho de autorizacao ausente');
    }
    return correspondencia[1];
  }
}
