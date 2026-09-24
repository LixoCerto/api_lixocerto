import { describe, expect, it } from 'vitest';
import { ServicoGamificacao } from '../../src/modulos/gamificacao/gamificacao.servico.js';
import { RepositorioProgresso } from '../../src/modulos/gamificacao/progresso.repositorio.js';

describe('ServicoGamificacao', () => {
  const servico = new ServicoGamificacao({} as RepositorioProgresso);

  it('calcula níveis sem misturar gamificação com autorização', () => {
    expect(servico.calcularNivel(0)).toBe('iniciante');
    expect(servico.calcularNivel(500)).toBe('explorador');
    expect(servico.calcularNivel(1000)).toBe('reciclador');
    expect(servico.calcularNivel(2000)).toBe('agente_ambiental');
    expect(servico.calcularNivel(4000)).toBe('guerreiro_ecologico');
  });

  it('não permite pontuação negativa', () => {
    expect(servico.aplicarPontos(20, -100)).toEqual({
      quantidadePontos: 0,
      nivelGamificacao: 'iniciante',
    });
  });
});
