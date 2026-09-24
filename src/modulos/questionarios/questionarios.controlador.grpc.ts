import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { ServicoQuestionarios } from './questionarios.servico.js';

interface RespostaListarQuestoes {
  questoes: Array<{
    id_questao: string;
    enunciado_questao: string;
    quantidade_pontos: number;
    alternativas: Array<{
      id_alternativa: string;
      texto_alternativa: string;
      ordem_exibicao: number;
    }>;
  }>;
}

@Controller()
export class ControladorGrpcQuestionarios {
  constructor(private readonly servico: ServicoQuestionarios) {}

  @GrpcMethod('ServicoQuestionarios', 'ListarQuestoes')
  async listarQuestoes(requisicao: { numero_pagina?: number; tamanho_pagina?: number }): Promise<RespostaListarQuestoes> {
    const questoes = await this.servico.listar(requisicao.numero_pagina, requisicao.tamanho_pagina);
    return {
      questoes: questoes.map(({ questao, alternativas }) => ({
        id_questao: questao.lcr_que_id_questao,
        enunciado_questao: questao.lcr_que_enunciado_questao,
        quantidade_pontos: questao.lcr_que_quantidade_pontos,
        alternativas: alternativas.map(alternativa => ({
          id_alternativa: alternativa.lcr_alt_id_alternativa,
          texto_alternativa: alternativa.lcr_alt_texto_alternativa,
          ordem_exibicao: alternativa.lcr_alt_ordem_exibicao,
        })),
      })),
    };
  }

  @GrpcMethod('ServicoQuestionarios', 'EnviarRespostaQuestionario')
  async enviarRespostaQuestionario(
    requisicao: { id_questao?: string; id_alternativa?: string },
    metadados: Metadata,
  ) {
    const idExternoUsuario = metadados.get('x-id-usuario-externo')[0];
    return this.servico.responder(
      requisicao.id_questao ?? '',
      requisicao.id_alternativa ?? '',
      typeof idExternoUsuario === 'string' ? idExternoUsuario : undefined,
    );
  }
}
