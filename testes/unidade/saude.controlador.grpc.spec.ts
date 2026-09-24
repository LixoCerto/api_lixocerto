import { describe, expect, it } from 'vitest';
import { ControladorGrpcSaude } from '../../src/modulos/saude/saude.controlador.grpc.js';
import { ServicoSaude } from '../../src/modulos/saude/saude.servico.js';

describe('ControladorGrpcSaude', () => {
  it('retorna o estado saudável sem dependências configuradas', async () => {
    const resposta = await new ControladorGrpcSaude(new ServicoSaude(null, null)).verificar();

    expect(resposta.status_servico).toBe('saudavel');
    expect(resposta.data_verificacao).toMatch(/T/);
    expect(resposta.status_banco).toBe('nao_configurado');
    expect(resposta.status_redis).toBe('nao_configurado');
  });
});
