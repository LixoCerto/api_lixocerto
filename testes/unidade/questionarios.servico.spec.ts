import { describe, expect, it, vi } from 'vitest';
import { RepositorioProgresso } from '../../src/modulos/gamificacao/progresso.repositorio.js';
import { ServicoGamificacao } from '../../src/modulos/gamificacao/gamificacao.servico.js';
import { RepositorioQuestionarios } from '../../src/modulos/questionarios/questionarios.repositorio.js';
import { ServicoQuestionarios } from '../../src/modulos/questionarios/questionarios.servico.js';
import { ServicoUsuarios } from '../../src/modulos/usuarios/usuarios.servico.js';

function novoServico(repositorio = new RepositorioQuestionarios(null)) {
  return new ServicoQuestionarios(
    repositorio,
    new ServicoUsuarios(null),
    new ServicoGamificacao({} as RepositorioProgresso),
  );
}

const dadosValidos = {
  enunciadoQuestao: 'Como descartar uma pilha usada?',
  explicacaoQuestao: 'Leve a um ponto que aceite pilhas.',
  quantidadePontos: 25,
  temaQuestao: 'pilhas',
  alternativas: [
    { textoAlternativa: 'Ponto de coleta apropriado', indicaCorreta: true, ordemExibicao: 1 },
    { textoAlternativa: 'Lixo comum', indicaCorreta: false, ordemExibicao: 2 },
  ],
};

describe('ServicoQuestionarios', () => {
  it('não lista questões quando a persistência não está configurada', async () => {
    const servico = novoServico();
    expect(await servico.listar('usuario-externo', 1, 20)).toEqual([]);
    expect(await servico.listarGestao({ status: 'todos' })).toEqual({ questoes: [], quantidadeTotal: 0 });
  });

  it('não concede pontos para questão indisponível', async () => {
    const servico = novoServico();
    expect(await servico.responder('questao-inexistente', 'alternativa-inexistente')).toEqual({
      indicaCorreta: false,
      quantidadePontos: 0,
      explicacaoResposta: 'Questão ou atribuição indisponível. Cada questão pode ser respondida uma única vez.',
    });
  });

  it('não consulta o banco quando os identificadores da resposta estão vazios', async () => {
    const repositorio = { obterResposta: async () => { throw new Error('não deveria consultar o banco'); } } as unknown as RepositorioQuestionarios;
    const servico = novoServico(repositorio);
    await expect(servico.responder('', '')).resolves.toEqual({
      indicaCorreta: false,
      quantidadePontos: 0,
      explicacaoResposta: 'Questão ou atribuição indisponível. Cada questão pode ser respondida uma única vez.',
    });
  });

  it('valida uma resposta correta única e guarda novas questões como rascunho', async () => {
    const servico = novoServico();
    await expect(servico.criar(dadosValidos)).resolves.toBeNull();
    expect(() => servico.criar({ ...dadosValidos, alternativas: dadosValidos.alternativas.map(item => ({ ...item, indicaCorreta: false })) }))
      .toThrow('Marque exatamente uma alternativa correta');
  });

  it('rejeita alternativas duplicadas', async () => {
    const servico = novoServico();
    expect(() => servico.criar({
      ...dadosValidos,
      alternativas: [
        { textoAlternativa: 'Lixo comum', indicaCorreta: true, ordemExibicao: 1 },
        { textoAlternativa: 'lixo comum', indicaCorreta: false, ordemExibicao: 2 },
      ],
    })).toThrow('As alternativas não podem se repetir');
  });

  it('não concede novamente os pontos de uma questão já respondida corretamente', async () => {
    const repositorio = {
      registrarTentativa: async () => ({
        registrada: false,
        jaRespondida: true,
        indicaCorreta: false,
        quantidadePontos: 0,
        explicacaoResposta: 'Você já respondeu esta questão; novas tentativas não são permitidas.',
      }),
    } as unknown as RepositorioQuestionarios;
    const gamificacao = { concederPontos: vi.fn() } as unknown as ServicoGamificacao;
    const usuarios = { obterIdInterno: async () => 'usuario-interno' } as unknown as ServicoUsuarios;
    const servico = new ServicoQuestionarios(repositorio, usuarios, gamificacao);

    await expect(servico.responder('questao-1', 'alternativa-1', 'usuario-externo')).resolves.toEqual({
      indicaCorreta: false,
      quantidadePontos: 0,
      explicacaoResposta: 'Você já respondeu esta questão; novas tentativas não são permitidas.',
    });
    expect(gamificacao.concederPontos).not.toHaveBeenCalled();
  });

  it('grava pontos corretos na mesma tentativa e reconcilia metas após o commit', async () => {
    const transacao = {};
    const gamificacao = { concederPontos: vi.fn().mockResolvedValue(undefined) } as unknown as ServicoGamificacao;
    const desafios = { processarProgresso: vi.fn().mockResolvedValue(undefined) };
    const repositorio = {
      registrarTentativa: vi.fn(async (_dados: unknown, aoResponderCorretamente: (evento: { idAtribuicao: string; temaQuestao: string; quantidadePontos: number }, tx: never) => Promise<unknown>) => {
        await aoResponderCorretamente({ idAtribuicao: 'atribuicao-1', temaQuestao: 'pilhas', quantidadePontos: 27 }, transacao as never);
        return { registrada: true, indicaCorreta: true, quantidadePontos: 27, explicacaoResposta: 'Correta.', idAtribuicao: 'atribuicao-1', temaQuestao: 'pilhas' };
      }),
    } as unknown as RepositorioQuestionarios;
    const usuarios = { obterIdInterno: vi.fn().mockResolvedValue('usuario-interno') } as unknown as ServicoUsuarios;
    const servico = new ServicoQuestionarios(repositorio, usuarios, gamificacao, desafios as never);

    await expect(servico.responder('questao-1', 'alternativa-1', 'usuario-externo')).resolves.toMatchObject({
      indicaCorreta: true,
      quantidadePontos: 27,
      explicacaoResposta: 'Correta.',
    });
    expect(gamificacao.concederPontos).toHaveBeenCalledWith('usuario-interno', 27, 'quiz_correto', 'atribuicao-1', 'pilhas', transacao);
    expect(desafios.processarProgresso).toHaveBeenCalledWith('usuario-interno');
  });
});
