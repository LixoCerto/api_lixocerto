import { describe, expect, it } from 'vitest';
import { RepositorioProgresso } from '../../src/modulos/gamificacao/progresso.repositorio.js';
import { ServicoGamificacao } from '../../src/modulos/gamificacao/gamificacao.servico.js';
import { RepositorioQuestionarios } from '../../src/modulos/questionarios/questionarios.repositorio.js';
import { ServicoQuestionarios } from '../../src/modulos/questionarios/questionarios.servico.js';
import { ServicoUsuarios } from '../../src/modulos/usuarios/usuarios.servico.js';

describe('ServicoQuestionarios', () => {
  it('não lista questões quando a persistência não está configurada', async () => {
    const servico = new ServicoQuestionarios(
      new RepositorioQuestionarios(null),
      new ServicoUsuarios(null),
      new ServicoGamificacao({} as RepositorioProgresso),
    );

    expect(await servico.listar(1, 20)).toEqual([]);
  });

  it('não concede pontos para questão indisponível', async () => {
    const servico = new ServicoQuestionarios(
      new RepositorioQuestionarios(null),
      new ServicoUsuarios(null),
      new ServicoGamificacao({} as RepositorioProgresso),
    );

    expect(await servico.responder('questao-inexistente', 'alternativa-inexistente')).toEqual({
      indicaCorreta: false,
      quantidadePontos: 0,
      explicacaoResposta: 'Questao ou alternativa indisponivel.',
    });
  });

  it('não consulta o banco quando os identificadores da resposta estão vazios', async () => {
    const repositorio = {
      obterResposta: async () => { throw new Error('não deveria consultar o banco'); },
    } as unknown as RepositorioQuestionarios;
    const servico = new ServicoQuestionarios(
      repositorio,
      new ServicoUsuarios(null),
      new ServicoGamificacao({} as RepositorioProgresso),
    );

    await expect(servico.responder('', '')).resolves.toEqual({
      indicaCorreta: false,
      quantidadePontos: 0,
      explicacaoResposta: 'Questao ou alternativa indisponivel.',
    });
  });
});
