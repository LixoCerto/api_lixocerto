import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ServicoMateriais } from './materiais.servico.js';

interface RequisicaoListarMateriais {
  texto_pesquisa?: string;
  categoria_material?: string;
  numero_pagina?: number;
  tamanho_pagina?: number;
}

interface RespostaListarMateriais {
  materiais: Array<{
    id_material: string;
    nome_material: string;
    categoria_material: string;
    instrucao_descarte: string;
    observacao_impacto: string;
    status_material: string;
  }>;
  quantidade_total: number;
}

@Controller()
export class ControladorGrpcMateriais {
  constructor(private readonly servico: ServicoMateriais) {}

  @GrpcMethod('ServicoMateriais', 'ListarMateriais')
  async listarMateriais(requisicao: RequisicaoListarMateriais): Promise<RespostaListarMateriais> {
    const resultado = await this.servico.listar({
      textoPesquisa: requisicao.texto_pesquisa,
      categoriaMaterial: requisicao.categoria_material,
      numeroPagina: requisicao.numero_pagina,
      tamanhoPagina: requisicao.tamanho_pagina,
    });

    return {
      materiais: resultado.materiais.map(material => ({
        id_material: material.lcr_mat_id_material,
        nome_material: material.lcr_mat_nome_material,
        categoria_material: material.lcr_mat_categoria_material,
        instrucao_descarte: material.lcr_mat_instrucao_descarte,
        observacao_impacto: material.lcr_mat_observacao_impacto,
        status_material: material.lcr_mat_status_material,
      })),
      quantidade_total: resultado.quantidadeTotal,
    };
  }
}
