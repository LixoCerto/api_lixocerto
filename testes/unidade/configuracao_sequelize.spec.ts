import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const caminhoConfiguracao = require.resolve('../../configuracao_sequelize.cjs');
const valorOriginal = process.env.BANCO_DADOS_SSL;

function carregarConfiguracao() {
  delete require.cache[caminhoConfiguracao];
  return require(caminhoConfiguracao) as Record<string, { dialectOptions?: { ssl?: { require: boolean; rejectUnauthorized: boolean } } }>;
}

afterEach(() => {
  if (valorOriginal === undefined) delete process.env.BANCO_DADOS_SSL;
  else process.env.BANCO_DADOS_SSL = valorOriginal;
  delete require.cache[caminhoConfiguracao];
});

describe('configuração Sequelize de migrations', () => {
  it('não força SSL quando BANCO_DADOS_SSL não está habilitado', () => {
    process.env.BANCO_DADOS_SSL = 'false';
    const configuracao = carregarConfiguracao();

    expect(configuracao.development.dialectOptions).toBeUndefined();
    expect(configuracao.production.dialectOptions).toBeUndefined();
  });

  it('usa TLS validado em todos os ambientes quando BANCO_DADOS_SSL=true', () => {
    process.env.BANCO_DADOS_SSL = 'true';
    const configuracao = carregarConfiguracao();
    const tlsEsperado = { ssl: { require: true, rejectUnauthorized: true } };

    expect(configuracao.development.dialectOptions).toEqual(tlsEsperado);
    expect(configuracao.production.dialectOptions).toEqual(tlsEsperado);
  });
});
