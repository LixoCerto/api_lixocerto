import { Controller } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { GrpcMethod } from '@nestjs/microservices';
import { ServicoAutenticacao } from '../autenticacao/autenticacao.servico.js';
import { ServicoAutorizacao } from '../autorizacao/autorizacao.servico.js';
import { ServicoAvaliacaoUsabilidade } from './avaliacao_usabilidade.servico.js';

@Controller()
export class ControladorGrpcAvaliacaoUsabilidade {
  constructor(
    private readonly servico: ServicoAvaliacaoUsabilidade,
    private readonly autenticacao: ServicoAutenticacao,
    private readonly autorizacao: ServicoAutorizacao,
  ) {}

  @GrpcMethod('ServicoAvaliacaoUsabilidade', 'EnviarAvaliacaoSus')
  async enviarAvaliacaoSus(requisicao: { codigo_participante?: string; indica_consentimento?: boolean; notas_itens?: number[] }, metadados: Metadata) {
    const valor = metadados.get('authorization')[0];
    const autorizacao = Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
    const usuario = await this.autenticacao.obterIdentidadeAtual(autorizacao);
    this.autorizacao.exigirPermissao(usuario, 'avaliacao_usabilidade:enviar');
    return this.servico.enviar(
      usuario.idExterno,
      requisicao.indica_consentimento === true,
      requisicao.notas_itens ?? [],
    ).then(resultado => ({
      avaliacao_aceita: resultado.avaliacaoAceita,
      pontuacao_sus: resultado.pontuacaoSus,
      mensagem_resultado: resultado.mensagemResultado,
    }));
  }

  @GrpcMethod('ServicoAvaliacaoUsabilidade', 'ObterResultadosAgregados')
  async obterResultadosAgregados(_requisicao: unknown, metadados: Metadata) {
    const valor = metadados.get('authorization')[0];
    const autorizacao = Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
    const usuario = await this.autenticacao.obterIdentidadeAtual(autorizacao);
    this.autorizacao.exigirPermissao(usuario, 'avaliacao_usabilidade:consultar_agregados');
    const resultado = await this.servico.obterResultadosAgregados();
    return {
      quantidade_participantes: resultado.quantidadeParticipantes,
      media_pontuacao_sus: resultado.mediaPontuacaoSus,
      mediana_pontuacao_sus: resultado.medianaPontuacaoSus,
    };
  }
}
