import { describe, expect, it } from 'vitest';
import { ServicoAdministracao } from '../../src/modulos/administracao/administracao.servico.js';
import { ServicoPapeis } from '../../src/modulos/papeis/papeis.servico.js';
import { ServicoPermissoes } from '../../src/modulos/permissoes/permissoes.servico.js';

describe('administracao e catalogos', () => {
  it('retorna resumo neutro quando o banco não está disponível', async () => {
    await expect(new ServicoAdministracao(null).obterResumo()).resolves.toEqual({
      quantidadeUsuarios: 0,
      quantidadeMateriais: 0,
      quantidadePontosPendentes: 0,
      quantidadeAvaliacoes: 0,
    });
  });

  it('não expõe catálogos quando a persistência está indisponível', async () => {
    await expect(new ServicoPapeis(null).listarAtivos()).resolves.toEqual([]);
    await expect(new ServicoPermissoes(null).listarAtivas()).resolves.toEqual([]);
  });
});
