import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ServicoPontosColeta } from './pontos_coleta.servico.js';

interface RespostaListarPontosColeta {
  pontos_coleta: Array<{
    id_ponto_coleta: string;
    nome_ponto_coleta: string;
    endereco_ponto_coleta: string;
    cidade_ponto_coleta: string;
    estado_ponto_coleta: string;
    latitude_ponto_coleta: number | null;
    longitude_ponto_coleta: number | null;
    status_verificacao: string;
    categorias_aceitas: string[];
  }>;
}

@Controller()
export class ControladorGrpcPontosColeta {
  constructor(private readonly servico: ServicoPontosColeta) {}

  @GrpcMethod('ServicoPontosColeta', 'ListarPontosColeta')
  async listarPontosColeta(requisicao: { cidade_ponto_coleta?: string }): Promise<RespostaListarPontosColeta> {
    const pontos = await this.servico.listar({ cidadePontoColeta: requisicao.cidade_ponto_coleta });

    return {
      pontos_coleta: pontos.map(ponto => ({
        id_ponto_coleta: ponto.lcr_pco_id_ponto_coleta,
        nome_ponto_coleta: ponto.lcr_pco_nome_ponto_coleta,
        endereco_ponto_coleta: ponto.lcr_pco_endereco_ponto_coleta,
        cidade_ponto_coleta: ponto.lcr_pco_cidade_ponto_coleta,
        estado_ponto_coleta: ponto.lcr_pco_estado_ponto_coleta,
        latitude_ponto_coleta: ponto.lcr_pco_latitude_ponto_coleta,
        longitude_ponto_coleta: ponto.lcr_pco_longitude_ponto_coleta,
        status_verificacao: ponto.lcr_pco_status_verificacao,
        categorias_aceitas: [],
      })),
    };
  }
}
