import { Inject, Injectable } from '@nestjs/common';
import { Op, Sequelize } from 'sequelize';
import { ModeloMaterial } from '../../infraestrutura/banco/modelos/material.modelo.js';

export interface FiltroMateriais {
  textoPesquisa?: string;
  categoriaMaterial?: string;
  numeroPagina?: number;
  tamanhoPagina?: number;
}

@Injectable()
export class RepositorioMateriais {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async listar(filtro: FiltroMateriais) {
    if (!this.banco) {
      return { materiais: [], quantidadeTotal: 0 };
    }

    const numeroPagina = Math.max(1, filtro.numeroPagina ?? 1);
    const tamanhoPagina = Math.min(100, Math.max(1, filtro.tamanhoPagina ?? 20));
    const texto = filtro.textoPesquisa?.trim();
    const condicoes: Record<string, unknown> = {
      lcr_mat_status_material: 'publicado',
    };

    if (filtro.categoriaMaterial?.trim()) {
      condicoes.lcr_mat_categoria_material = filtro.categoriaMaterial.trim();
    }
    if (texto) {
      condicoes[Op.or as unknown as string] = [
        { lcr_mat_nome_material: { [Op.iLike]: `%${texto}%` } },
        { lcr_mat_instrucao_descarte: { [Op.iLike]: `%${texto}%` } },
      ];
    }

    const resultado = await ModeloMaterial.findAndCountAll({
      where: condicoes,
      order: [['lcr_mat_nome_material', 'ASC']],
      limit: tamanhoPagina,
      offset: (numeroPagina - 1) * tamanhoPagina,
    });

    return {
      materiais: resultado.rows,
      quantidadeTotal: resultado.count,
    };
  }
}
