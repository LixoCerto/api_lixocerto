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
  alternativas: [
    { textoAlternativa: 'Ponto de coleta apropriado', indicaCorreta: true, ordemExibicao: 1 },
    { textoAlternativa: 'Lixo comum', indicaCorreta: false, ordemExibicao: 2 },
  ],
};

describe('ServicoQuestionarios', () => {
  it('não lista questões quando a persistência não está configurada', async () => {
    const servico = novoServico();
    expect(await servico.listar(1, 20)).toEqual([]);
    expect(await servico.listarGestao({ status: 'todos' })).toEqual({ questoes: [], quantidadeTotal: 0 });
  });

  it('não concede pontos para questão indisponível', async () => {
    const servico = novoServico();
    expect(await servico.responder('questao-inexistente', 'alternativa-inexistente')).toEqual({
      indicaCorreta: false,
      quantidadePontos: 0,
      explicacaoResposta: 'Questao ou alternativa indisponivel.',
    });
  });

  it('não consulta o banco quando os identificadores da resposta estão vazios', async () => {
    const repositorio = { obterResposta: async () => { throw new Error('não deveria consultar o banco'); } } as unknown as RepositorioQuestionarios;
    const servico = novoServico(repositorio);
    await expect(servico.responder('', '')).resolves.toEqual({
      indicaCorreta: false,
      quantidadePontos: 0,
      explicacaoResposta: 'Questao ou alternativa indisponivel.',
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
      obterResposta: async () => ({
        questao: { lcr_que_quantidade_pontos: 25, lcr_que_explicacao_questao: 'Leve a um ponto apropriado.' },
        alternativa: { lcr_alt_indica_correta: true },
      }),
      registrarTentativa: async () => false,
    } as unknown as RepositorioQuestionarios;
    const gamificacao = { concederPontos: vi.fn() } as unknown as ServicoGamificacao;
    const usuarios = { obterIdInterno: async () => 'usuario-interno' } as unknown as ServicoUsuarios;
    const servico = new ServicoQuestionarios(repositorio, usuarios, gamificacao);

    await expect(servico.responder('questao-1', 'alternativa-1', 'usuario-externo')).resolves.toEqual({
      indicaCorreta: true,
      quantidadePontos: 0,
      explicacaoResposta: 'Você já recebeu a recompensa desta questão.',
    });
    expect(gamificacao.concederPontos).not.toHaveBeenCalled();
  });
});
