import { describe, expect, it, vi } from 'vitest';
import { Metadata } from '@grpc/grpc-js';
import { ControladorGrpcAvaliacaoUsabilidade } from '../../src/modulos/avaliacao_usabilidade/avaliacao_usabilidade.controlador.grpc.js';
import { ControladorGrpcQuestionarios } from '../../src/modulos/questionarios/questionarios.controlador.grpc.js';
import { ServicoAvaliacaoUsabilidade } from '../../src/modulos/avaliacao_usabilidade/avaliacao_usabilidade.servico.js';
import { ServicoQuestionarios } from '../../src/modulos/questionarios/questionarios.servico.js';

const identidade = {
  idExterno: 'local:usuario-teste',
  nome: 'Usuário teste',
  email: 'usuario@exemplo.test',
  papeis: ['usuario'],
  permissoes: ['questionarios:responder'],
};

function dependenciasQuestionario(servico: object) {
  return [
    servico,
    { obterIdentidadeAtual: vi.fn().mockResolvedValue(identidade) },
    { exigirPermissao: vi.fn() },
    { obterIdInterno: vi.fn().mockResolvedValue('usuario-interno') },
    { registrar: vi.fn().mockResolvedValue(undefined) },
  ] as unknown as ConstructorParameters<typeof ControladorGrpcQuestionarios>;
}

describe('serialização dos controladores gRPC', () => {
  it('converte o resultado SUS para snake_case do Protobuf', async () => {
    const servico = { enviar: vi.fn().mockResolvedValue({ avaliacaoAceita: false, pontuacaoSus: 0, mensagemResultado: 'Consentimento obrigatorio.' }) };
    const autenticacao = { obterIdentidadeAtual: vi.fn().mockResolvedValue(identidade) };
    const autorizacao = { exigirPermissao: vi.fn() };
    const controlador = new ControladorGrpcAvaliacaoUsabilidade(
      servico as unknown as ServicoAvaliacaoUsabilidade,
      autenticacao as never,
      autorizacao as never,
    );
    const metadados = new Metadata();
    metadados.set('authorization', 'Bearer token-teste');

    await expect(controlador.enviarAvaliacaoSus({ codigo_participante: 'identidade-de-outra-pessoa', indica_consentimento: true, notas_itens: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3] }, metadados)).resolves.toEqual({
      avaliacao_aceita: false,
      pontuacao_sus: 0,
      mensagem_resultado: 'Consentimento obrigatorio.',
    });
    expect(autenticacao.obterIdentidadeAtual).toHaveBeenCalledWith('Bearer token-teste');
    expect(autorizacao.exigirPermissao).toHaveBeenCalledWith(identidade, 'avaliacao_usabilidade:enviar');
    expect(servico.enviar).toHaveBeenCalledWith(identidade.idExterno, true, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
  });

  it('informa quando a tentativa de quiz não foi registrada', async () => {
    const servico = { responder: vi.fn().mockResolvedValue({
      tentativaRegistrada: false,
      questaoJaRespondida: false,
      indicaCorreta: false,
      quantidadePontos: 0,
      explicacaoResposta: 'Questao ou alternativa indisponivel.',
    }) };
    const controlador = new ControladorGrpcQuestionarios(...dependenciasQuestionario(servico));
    const metadados = new Metadata();
    metadados.set('authorization', 'Bearer token-teste');

    await expect(controlador.enviarRespostaQuestionario({ id_questao: 'questao-1', id_alternativa: 'alternativa-1' }, metadados)).resolves.toEqual({
      tentativa_registrada: false,
      questao_ja_respondida: false,
      indica_correta: false,
      quantidade_pontos: 0,
      explicacao_resposta: 'Questao ou alternativa indisponivel.',
    });
    expect(servico.responder).toHaveBeenCalledWith('questao-1', 'alternativa-1', identidade.idExterno);
  });

  it('serializa a confirmação de uma resposta de quiz registrada', async () => {
    const servico = { responder: vi.fn().mockResolvedValue({
      tentativaRegistrada: true,
      questaoJaRespondida: false,
      indicaCorreta: true,
      quantidadePontos: 25,
      explicacaoResposta: 'Correta.',
    }) };
    const controlador = new ControladorGrpcQuestionarios(...dependenciasQuestionario(servico));
    const metadados = new Metadata();
    metadados.set('authorization', 'Bearer token-teste');

    await expect(controlador.enviarRespostaQuestionario({ id_questao: 'questao-1', id_alternativa: 'alternativa-1' }, metadados)).resolves.toEqual({
      tentativa_registrada: true,
      questao_ja_respondida: false,
      indica_correta: true,
      quantidade_pontos: 25,
      explicacao_resposta: 'Correta.',
    });
  });

  it('distingue uma questão já respondida de uma nova tentativa registrada', async () => {
    const servico = { responder: vi.fn().mockResolvedValue({
      tentativaRegistrada: false,
      questaoJaRespondida: true,
      indicaCorreta: false,
      quantidadePontos: 0,
      explicacaoResposta: 'Você já respondeu esta questão; novas tentativas não são permitidas.',
    }) };
    const controlador = new ControladorGrpcQuestionarios(...dependenciasQuestionario(servico));
    const metadados = new Metadata();
    metadados.set('authorization', 'Bearer token-teste');

    await expect(controlador.enviarRespostaQuestionario({ id_questao: 'questao-1', id_alternativa: 'alternativa-1' }, metadados)).resolves.toMatchObject({
      tentativa_registrada: false,
      questao_ja_respondida: true,
    });
  });
});
