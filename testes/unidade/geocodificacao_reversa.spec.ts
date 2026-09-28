import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeocodificacaoReversa } from '../../src/modulos/pontos_coleta/geocodificacao_reversa.servico.js';

afterEach(() => vi.unstubAllGlobals());

describe('geocodificação reversa de pontos de coleta', () => {
  it('mapeia CEP/endereço brasileiro e reutiliza coordenadas arredondadas do cache', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      address: {
        country_code: 'br',
        postcode: '58013-000',
        road: 'Avenida Exemplo',
        house_number: '120',
        neighbourhood: 'Centro',
        city: 'João Pessoa',
        state: 'Paraíba',
        'ISO3166-2-lvl4': 'BR-PB',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const geocodificador = new GeocodificacaoReversa();

    const primeiro = await geocodificador.buscar(-7.111111, -34.888888);
    const segundo = await geocodificador.buscar(-7.111112, -34.888889);

    expect(primeiro).toEqual({
      cep_ponto_coleta: '58013000',
      endereco_ponto_coleta: 'Avenida Exemplo, 120 - Centro',
      cidade_ponto_coleta: 'João Pessoa',
      estado_ponto_coleta: 'PB',
      atribuicao: '© OpenStreetMap contributors',
    });
    expect(segundo).toEqual(primeiro);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const chamada = fetchMock.mock.calls[0];
    expect(String(chamada?.[0])).toContain('/reverse?');
    expect(new Headers(chamada?.[1]?.headers).get('User-Agent')).toContain('LixoCerto/1.0');
  });

  it('não preenche endereços fora do Brasil', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      address: { country_code: 'pt', postcode: '1000-001', road: 'Rua Exemplo' },
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    await expect(new GeocodificacaoReversa().buscar(38.7223, -9.1393)).resolves.toBeNull();
  });
});
