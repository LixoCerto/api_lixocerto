import { describe, expect, it } from 'vitest';
import { ControladorGrpcSaude } from '../../src/modulos/saude/saude.controlador.grpc.js';

describe('ControladorGrpcSaude', () => {
  it('retorna o estado saudavel do servico', () => {
    const resposta = new ControladorGrpcSaude().verificar();

    expect(resposta.status_servico).toBe('saudavel');
    expect(resposta.data_verificacao).toMatch(/T/);
  });
});
