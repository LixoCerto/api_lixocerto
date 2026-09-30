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
  ] as const;
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

  it('serializa resposta de quiz e registra a tentativa do usuário autenticado', async () => {
    const servico = { responder: vi.fn().mockResolvedValue({
      indicaCorreta: false,
      quantidadePontos: 0,
      explicacaoResposta: 'Questao ou alternativa indisponivel.',
    }) };
    const controlador = new ControladorGrpcQuestionarios(...dependenciasQuestionario(servico) as never);
    const metadados = new Metadata();
    metadados.set('authorization', 'Bearer token-teste');

    await expect(controlador.enviarRespostaQuestionario({ id_questao: 'questao-1', id_alternativa: 'alternativa-1' }, metadados)).resolves.toEqual({
      indica_correta: false,
      quantidade_pontos: 0,
      explicacao_resposta: 'Questao ou alternativa indisponivel.',
    });
    expect(servico.responder).toHaveBeenCalledWith('questao-1', 'alternativa-1', identidade.idExterno);
  });
});
