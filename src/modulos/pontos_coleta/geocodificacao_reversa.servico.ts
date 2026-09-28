import { Injectable } from '@nestjs/common';

export interface EnderecoGeocodificado {
  cep_ponto_coleta: string;
  endereco_ponto_coleta: string;
  cidade_ponto_coleta: string;
  estado_ponto_coleta: string;
  atribuicao: string;
}

type ResultadoNominatim = {
  address?: Record<string, string | undefined>;
};

type ItemCache = {
  expiraEm: number;
  valor: EnderecoGeocodificado | null;
};

const ATRIBUICAO = '© OpenStreetMap contributors';
const URL_ATRIBUICAO = 'https://www.openstreetmap.org/copyright';
const TTL_CACHE_MS = 24 * 60 * 60 * 1000;
const LIMITE_CACHE = 500;
const INTERVALO_MINIMO_MS = 1000;
const UF_POR_ESTADO: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapá: 'AP', amazonas: 'AM', bahia: 'BA', ceará: 'CE',
  'distrito federal': 'DF', 'espírito santo': 'ES', goiás: 'GO', maranhão: 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', pará: 'PA',
  paraíba: 'PB', paraná: 'PR', pernambuco: 'PE', piauí: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondônia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'são paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

@Injectable()
export class GeocodificacaoReversa {
  private readonly cache = new Map<string, ItemCache>();
  private fila: Promise<void> = Promise.resolve();
  private ultimaConsulta = 0;

  async buscar(latitude: number, longitude: number): Promise<EnderecoGeocodificado | null> {
    const chave = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    const cacheado = this.cache.get(chave);
    if (cacheado && cacheado.expiraEm > Date.now()) return cacheado.valor;
    if (cacheado) this.cache.delete(chave);

    const consulta = this.fila.then(async () => {
      const cacheAtualizado = this.cache.get(chave);
      if (cacheAtualizado && cacheAtualizado.expiraEm > Date.now()) return cacheAtualizado.valor;
      const espera = Math.max(0, INTERVALO_MINIMO_MS - (Date.now() - this.ultimaConsulta));
      if (espera) await new Promise(resolve => setTimeout(resolve, espera));
      this.ultimaConsulta = Date.now();
      const resultado = await this.consultar(latitude, longitude);
      this.guardarCache(chave, resultado);
      return resultado;
    });
    this.fila = consulta.then(() => undefined, () => undefined);
    return consulta;
  }

  private async consultar(latitude: number, longitude: number): Promise<EnderecoGeocodificado | null> {
    const base = (process.env.NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');
    const url = new URL(`${base}/reverse`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('zoom', '18');
    url.searchParams.set('accept-language', 'pt-BR,pt');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));

    const resposta = await fetch(url, {
      headers: {
        'User-Agent': 'LixoCerto/1.0 (+https://github.com/LixoCerto)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!resposta.ok) throw new Error(`Geocodificação indisponível (${resposta.status})`);
    const dados = await resposta.json() as ResultadoNominatim;
    const address = dados.address ?? {};
    if ((address.country_code ?? '').toLowerCase() !== 'br') return null;

    const cepDigitos = (address.postcode ?? '').replace(/\D/g, '');
    const cep = cepDigitos.length === 8 ? cepDigitos : '';
    const logradouro = [address.road, address.house_number].filter(Boolean).join(', ');
    const bairro = address.neighbourhood ?? address.suburb ?? address.city_district ?? address.quarter;
    const endereco = [logradouro, bairro].filter(Boolean).join(' - ');
    const cidade = address.city ?? address.town ?? address.village ?? address.municipality ?? address.hamlet ?? '';
    const codigoEstado = (address['ISO3166-2-lvl4'] ?? address.state_code ?? '').match(/(?:BR-)?([A-Z]{2})$/i)?.[1]?.toUpperCase();
    const estadoNome = (address.state ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const estado = codigoEstado && /^[A-Z]{2}$/.test(codigoEstado)
      ? codigoEstado
      : UF_POR_ESTADO[estadoNome] ?? '';
    if (!cep && !endereco && !cidade && !estado) return null;

    return {
      cep_ponto_coleta: cep,
      endereco_ponto_coleta: endereco,
      cidade_ponto_coleta: cidade,
      estado_ponto_coleta: estado,
      atribuicao: ATRIBUICAO,
    };
  }

  private guardarCache(chave: string, valor: EnderecoGeocodificado | null): void {
    if (this.cache.size >= LIMITE_CACHE) {
      const maisAntiga = this.cache.keys().next().value;
      if (maisAntiga) this.cache.delete(maisAntiga);
    }
    this.cache.set(chave, { expiraEm: Date.now() + TTL_CACHE_MS, valor });
  }
}
