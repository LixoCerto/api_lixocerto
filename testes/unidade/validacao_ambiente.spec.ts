import { describe, expect, it } from 'vitest';
import { validarAmbiente } from '../../src/configuracao/validacao_ambiente.js';

describe('validacao de ambiente', () => {
  it('não exige infraestrutura completa em desenvolvimento', () => {
    expect(() => validarAmbiente({ AMBIENTE_EXECUCAO: 'desenvolvimento' })).not.toThrow();
  });

  it('exige variáveis críticas em produção', () => {
    expect(() => validarAmbiente({ AMBIENTE_EXECUCAO: 'producao' })).toThrow(/URL_BANCO_DADOS/);
  });

  it('rejeita server reflection explicitamente habilitado em produção', () => {
    expect(() => validarAmbiente({
      AMBIENTE_EXECUCAO: 'producao',
      HABILITAR_REFLECTION_GRPC: 'true',
    })).toThrow(/HABILITAR_REFLECTION_GRPC/);
  });

  it('rejeita segredo JWT curto mesmo com infraestrutura válida', () => {
    expect(() => validarAmbiente({
      AMBIENTE_EXECUCAO: 'producao',
      URL_BANCO_DADOS: 'postgres://usuario:senha@localhost:5432/banco',
      URL_REDIS: 'redis://localhost:6379',
      SEGREDO_JWT: 'curto',
      SEGREDO_HASH_PARTICIPANTE: 'segredo-de-participante-com-32-caracteres',
    })).toThrow(/SEGREDO_JWT/);
  });
});
