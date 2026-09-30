import { describe, expect, it, vi } from 'vitest';
import { RepositorioDescartes } from '../../src/modulos/pontos_coleta/descartes.repositorio.js';

const ID_REGISTRO = '55000000-0000-4000-8000-000000000001';
const ID_USUARIO = '55000000-0000-4000-8000-000000000002';
const ID_REVISOR = '55000000-0000-4000-8000-000000000003';
const ID_PONTO = '55000000-0000-4000-8000-000000000004';

describe('repositório de descartes', () => {
  it('não renova nem reativa uma foto vencida quando o registro é rejeitado', async () => {
    const banco = {
      transaction: vi.fn(async (callback: (transaction: object) => Promise<unknown>) => callback({})),
      query: vi.fn()
        .mockResolvedValueOnce([{
          idRegistro: ID_REGISTRO,
          idUsuario: ID_USUARIO,
          identificadorParticipante: '55000000',
          idPontoColeta: ID_PONTO,
          nomePontoColeta: 'Ponto de teste',
          cidadePontoColeta: 'João Pessoa',
          categoriaMaterial: 'pilhas',
          quantidade: 1,
          relato: '',
          status: 'pendente',
          dataRegistro: new Date('2026-09-30T12:00:00Z'),
          dataRevisao: null,
          idCheckin: null,
          chaveFoto: 'evidencia-expirada.webp',
          evidenciaDisponivel: false,
          temCheckin: false,
          distanciaCheckinMetros: 0,
          precisaoCheckinMetros: 0,
        }])
        .mockResolvedValueOnce([]),
    };
    const repositorio = new RepositorioDescartes(banco as never);

    const resultado = await repositorio.revisar(
      { idRegistro: ID_REGISTRO, idRevisor: ID_REVISOR, status: 'rejeitado' },
      vi.fn(),
    );

    expect(resultado?.status).toBe('rejeitado');
    const sqlAtualizacao = String(banco.query.mock.calls[1]?.[0]);
    expect(sqlAtualizacao).toContain('lcr_rde_foto_removida_em IS NULL');
    expect(sqlAtualizacao).toContain('lcr_rde_foto_expira_em > CURRENT_TIMESTAMP');
    expect(sqlAtualizacao).toContain('ELSE lcr_rde_foto_expira_em');
    expect(sqlAtualizacao).not.toContain("ELSE NULL");
  });
});
