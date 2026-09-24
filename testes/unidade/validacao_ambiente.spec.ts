import { describe, expect, it } from 'vitest';
import { validarAmbiente } from '../../src/configuracao/validacao_ambiente.js';

describe('validacao de ambiente', () => {
  it('não exige infraestrutura completa em desenvolvimento', () => {
    expect(() => validarAmbiente({ AMBIENTE_EXECUCAO: 'desenvolvimento' })).not.toThrow();
  });

  it('exige variáveis críticas em produção', () => {
    expect(() => validarAmbiente({ AMBIENTE_EXECUCAO: 'producao' })).toThrow(/URL_BANCO_DADOS/);
  });

  it('rejeita segredo curto mesmo com URLs válidas', () => {
    expect(() => validarAmbiente({
      AMBIENTE_EXECUCAO: 'producao',
      URL_BANCO_DADOS: 'postgres://usuario:senha@localhost:5432/banco',
      URL_REDIS: 'redis://localhost:6379',
      EMISSOR_OIDC: 'https://oidc.exemplo.test',
      AUDIENCIA_OIDC: 'lixo-certo-api',
      ENDERECO_JWKS: 'https://oidc.exemplo.test/.well-known/jwks.json',
      SEGREDO_HASH_PARTICIPANTE: 'curto',
    })).toThrow(/SEGREDO_HASH_PARTICIPANTE/);
  });
});
