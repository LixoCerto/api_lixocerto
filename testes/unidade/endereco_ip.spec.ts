import { describe, expect, it } from 'vitest';
import { normalizarEnderecoIp } from '../../src/comum/rede/endereco_ip.js';

describe('normalizarEnderecoIp', () => {
  it('prioriza o IP único enviado pelo Cloudflare', () => {
    expect(
      normalizarEnderecoIp(
        '198.51.100.42',
        '172.70.193.152, 172.18.0.1',
        '172.18.0.1',
      ),
    ).toBe('198.51.100.42');
  });

  it('reduz X-Forwarded-For ao primeiro IP válido da cadeia', () => {
    expect(
      normalizarEnderecoIp(undefined, '172.70.193.152, 172.18.0.1'),
    ).toBe('172.70.193.152');
  });

  it('usa X-Real-IP quando os outros headers não contêm um IP válido', () => {
    expect(
      normalizarEnderecoIp(undefined, 'valor inválido', '192.0.2.18'),
    ).toBe('192.0.2.18');
  });

  it('aceita IPv6 e não retorna listas ou valores inválidos', () => {
    expect(normalizarEnderecoIp('2001:db8::5')).toBe('2001:db8::5');
    expect(normalizarEnderecoIp(undefined, 'inválido', 'também inválido')).toBeUndefined();
  });
});
