import { describe, expect, it } from 'vitest';
import { calcularSequenciaDiasAtivos } from '../../src/modulos/gamificacao/progresso.repositorio.js';

describe('calcularSequenciaDiasAtivos', () => {
  const hoje = '2026-10-12';

  it('conta os dias consecutivos até hoje quando houve atividade hoje', () => {
    expect(calcularSequenciaDiasAtivos([
      '2026-10-12',
      '2026-10-11',
      '2026-10-10',
      '2026-10-08',
    ], hoje)).toBe(3);
  });

  it('mantém a sequência se a atividade mais recente foi ontem', () => {
    expect(calcularSequenciaDiasAtivos([
      '2026-10-11',
      '2026-10-10',
      '2026-10-09',
    ], hoje)).toBe(3);
  });

  it('retorna zero quando a sequência terminou antes de ontem', () => {
    expect(calcularSequenciaDiasAtivos(['2026-10-09', '2026-10-08'], hoje)).toBe(0);
  });

  it('retorna zero sem atividade e ignora datas duplicadas', () => {
    expect(calcularSequenciaDiasAtivos([], hoje)).toBe(0);
    expect(calcularSequenciaDiasAtivos(['2026-10-12', '2026-10-12'], hoje)).toBe(1);
  });

  it('trata a virada do mês ao percorrer a sequência', () => {
    expect(calcularSequenciaDiasAtivos(['2026-11-01', '2026-10-31'], '2026-11-01')).toBe(2);
  });
});
