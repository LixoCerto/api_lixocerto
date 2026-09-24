import { afterEach, describe, expect, it, vi } from 'vitest';
import { registrarEvento } from '../../src/comum/observabilidade/registrador.js';
import { ServicoSaude } from '../../src/modulos/saude/saude.servico.js';

describe('observabilidade e saúde', () => {
  afterEach(() => vi.restoreAllMocks());

  it('redige segredos também em objetos aninhados', () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    registrarEvento('teste', { token: 'secreto', contexto: { authorization: 'Bearer secreto', status: 'ok' } });
    const payload = JSON.parse(String(log.mock.calls[0]?.[0]));
    expect(payload.token).toBe('[REDACTED]');
    expect(payload.contexto.authorization).toBe('[REDACTED]');
    expect(payload.contexto.status).toBe('ok');
  });

  it('indica dependências não configuradas no health check', async () => {
    const resposta = await new ServicoSaude(null, null).verificar();
    expect(resposta).toMatchObject({
      statusServico: 'saudavel',
      statusBanco: 'nao_configurado',
      statusRedis: 'nao_configurado',
    });
  });
});
