import { describe, expect, it } from 'vitest';
import { Metadata } from '@grpc/grpc-js';
import { ControladorGrpcAvaliacaoUsabilidade } from '../../src/modulos/avaliacao_usabilidade/avaliacao_usabilidade.controlador.grpc.js';
import { ControladorGrpcQuestionarios } from '../../src/modulos/questionarios/questionarios.controlador.grpc.js';
import { ServicoAvaliacaoUsabilidade } from '../../src/modulos/avaliacao_usabilidade/avaliacao_usabilidade.servico.js';
import { ServicoAutenticacao } from '../../src/modulos/autenticacao/autenticacao.servico.js';
import { ServicoAutorizacao } from '../../src/modulos/autorizacao/autorizacao.servico.js';
import { ServicoQuestionarios } from '../../src/modulos/questionarios/questionarios.servico.js';

describe('serialização dos controladores gRPC', () => {
  it('converte o resultado SUS para snake_case do Protobuf', async () => {
    const controlador = new ControladorGrpcAvaliacaoUsabilidade(
      { enviar: async () => ({ avaliacaoAceita: false, pontuacaoSus: 0, mensagemResultado: 'Consentimento obrigatorio.' }) } as unknown as ServicoAvaliacaoUsabilidade,
      {} as ServicoAutenticacao,
      {} as ServicoAutorizacao,
    );

    await expect(controlador.enviarAvaliacaoSus({})).resolves.toEqual({
      avaliacao_aceita: false,
      pontuacao_sus: 0,
      mensagem_resultado: 'Consentimento obrigatorio.',
    });
  });

  it('converte o resultado de resposta de questionário para snake_case do Protobuf', async () => {
    const controlador = new ControladorGrpcQuestionarios({
      responder: async () => ({
        indicaCorreta: false,
        quantidadePontos: 0,
        explicacaoResposta: 'Questao ou alternativa indisponivel.',
      }),
    } as unknown as ServicoQuestionarios);
    const metadados = new Metadata();

    await expect(controlador.enviarRespostaQuestionario({}, metadados)).resolves.toEqual({
      indica_correta: false,
      quantidade_pontos: 0,
      explicacao_resposta: 'Questao ou alternativa indisponivel.',
    });
  });
});
