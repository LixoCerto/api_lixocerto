import { describe, expect, it } from 'vitest';
import { RepositorioProgresso } from '../../src/modulos/gamificacao/progresso.repositorio.js';
import { ServicoGamificacao } from '../../src/modulos/gamificacao/gamificacao.servico.js';

describe('ranking de gamificacao', () => {
  it('não retorna dados quando a persistência não está disponível', async () => {
    const servico = new ServicoGamificacao(new RepositorioProgresso(null));
    expect(await servico.obterRanking(10)).toEqual([]);
  });
});
