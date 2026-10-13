import { OAuth2Client } from 'google-auth-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VerificadorGoogleServico } from '../../src/modulos/autenticacao/verificador_google.servico.js';

const clientIdAnterior = process.env.GOOGLE_OAUTH_CLIENT_ID;

afterEach(() => {
  vi.restoreAllMocks();
  if (clientIdAnterior === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  else process.env.GOOGLE_OAUTH_CLIENT_ID = clientIdAnterior;
});

function simularPayload(payload: Record<string, unknown>) {
  return vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
    getPayload: () => payload,
  } as never);
}

describe('verificador de ID token Google', () => {
  it('valida audience e nonce e normaliza uma identidade Gmail verificada', async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id-teste';
    const verificarToken = simularPayload({
      sub: 'google-sub-123',
      email: 'Arthur@Gmail.com',
      email_verified: true,
      name: 'Arthur Teste',
      nonce: 'nonce-aleatorio',
    });

    await expect(new VerificadorGoogleServico().verificar('jwt-de-teste', 'nonce-aleatorio')).resolves.toEqual({
      sub: 'google-sub-123',
      email: 'arthur@gmail.com',
      nome: 'Arthur Teste',
      emailAutoritativo: true,
    });
    expect(verificarToken).toHaveBeenCalledWith({ idToken: 'jwt-de-teste', audience: 'client-id-teste' });
  });

  it('rejeita e-mail não verificado e nonce diferente', async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id-teste';
    simularPayload({
      sub: 'google-sub-456',
      email: 'pessoa@example.com',
      email_verified: false,
      name: 'Pessoa',
      nonce: 'nonce-incorreto',
    });
    await expect(new VerificadorGoogleServico().verificar('jwt-de-teste', 'nonce-esperado'))
      .rejects.toThrow('Credencial Google invalida');
  });

  it('considera autoritativo o e-mail verificado de um domínio Workspace', async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id-teste';
    simularPayload({
      sub: 'google-sub-789',
      email: 'pessoa@empresa.example',
      email_verified: true,
      hd: 'empresa.example',
      nonce: 'nonce-empresa',
    });
    await expect(new VerificadorGoogleServico().verificar('jwt-de-teste', 'nonce-empresa'))
      .resolves.toMatchObject({ emailAutoritativo: true, email: 'pessoa@empresa.example' });
  });

  it('falha de forma controlada quando o Client ID do backend não foi configurado', async () => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    await expect(new VerificadorGoogleServico().verificar('jwt-de-teste', 'nonce-teste'))
      .rejects.toThrow('Login Google nao configurado');
  });
});
