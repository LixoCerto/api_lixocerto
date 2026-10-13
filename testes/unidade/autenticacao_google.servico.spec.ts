import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ServicoAutenticacao } from '../../src/modulos/autenticacao/autenticacao.servico.js';

const identidadeGoogle = {
  sub: 'google-sub-teste',
  email: 'pessoa@gmail.com',
  nome: 'Pessoa Teste',
  emailAutoritativo: true,
};

function hash(valor: string): string {
  return createHash('sha256').update(valor, 'utf8').digest('hex');
}

describe('autenticacao Google', () => {
  it('bloqueia na origem antes de verificar o token quando o limite é excedido', async () => {
    const verificar = vi.fn();
    const autenticarComGoogle = vi.fn();
    const rateLimit = { permitir: vi.fn().mockResolvedValue({ permitido: false, restante: 0, disponivel: true }) };
    const servico = new ServicoAutenticacao({} as never, { verificar } as never, { autenticarComGoogle } as never, rateLimit as never, null);

    await expect(servico.entrarComGoogle('jwt-teste', 'nonce-teste', { enderecoIp: '198.51.100.42' }))
      .rejects.toThrow('Muitas tentativas');
    expect(verificar).not.toHaveBeenCalled();
    expect(autenticarComGoogle).not.toHaveBeenCalled();
    expect(rateLimit.permitir).toHaveBeenCalledWith(`lcr:auth:google:ip:${hash('198.51.100.42')}`, 30, 60);
  });

  it('falha de forma segura se o Redis necessário ao rate-limit estiver indisponível', async () => {
    const verificar = vi.fn();
    const rateLimit = { permitir: vi.fn().mockResolvedValue({ permitido: false, restante: 0, disponivel: false }) };
    const servico = new ServicoAutenticacao({} as never, { verificar } as never, {} as never, rateLimit as never, null);

    await expect(servico.entrarComGoogle('jwt-teste', 'nonce-teste', { enderecoIp: '198.51.100.42' }))
      .rejects.toThrow('Autenticacao Google temporariamente indisponivel');
    expect(verificar).not.toHaveBeenCalled();
  });

  it('limita a identidade Google e exige autenticação local para vincular e-mail não autoritativo existente', async () => {
    const identidadeExterna = { ...identidadeGoogle, emailAutoritativo: false };
    const verificar = vi.fn().mockResolvedValue(identidadeExterna);
    const autenticarComGoogle = vi.fn().mockRejectedValue(new Error('GOOGLE_LINK_REQUIRED'));
    const rateLimit = { permitir: vi.fn().mockResolvedValue({ permitido: true, restante: 9, disponivel: true }) };
    const servico = new ServicoAutenticacao({} as never, { verificar } as never, { autenticarComGoogle } as never, rateLimit as never, null);

    await expect(servico.entrarComGoogle('jwt-teste', 'nonce-teste', { enderecoIp: '198.51.100.42' }))
      .rejects.toThrow('Esta conta ja existe. Entre pelo metodo de login atual');
    expect(rateLimit.permitir).toHaveBeenNthCalledWith(1, `lcr:auth:google:ip:${hash('198.51.100.42')}`, 30, 60);
    expect(rateLimit.permitir).toHaveBeenNthCalledWith(2, `lcr:auth:google:sub:${hash(identidadeGoogle.sub)}`, 10, 300);
    expect(autenticarComGoogle).toHaveBeenCalledWith(identidadeExterna);
  });
});
