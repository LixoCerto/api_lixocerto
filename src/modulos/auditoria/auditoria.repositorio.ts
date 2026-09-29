import { Inject, Injectable } from '@nestjs/common';
import { Op, QueryTypes, Sequelize, Transaction } from 'sequelize';
import { ModeloRegistroAuditoria } from '../../infraestrutura/banco/modelos/registro_auditoria.modelo.js';

export interface DadosAuditoria {
  idUsuario?: string | null;
  tipoEvento: string;
  recursoEvento?: string;
  idRecurso?: string;
  enderecoIp?: string;
  idCorrelacao: string;
  detalhesEvento?: Record<string, unknown>;
}

@Injectable()
export class RepositorioAuditoria {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async registrar(dados: DadosAuditoria, transaction?: Transaction) {
    if (!this.banco) return null;
    return ModeloRegistroAuditoria.create({
      lcr_aud_id_usuario: dados.idUsuario ?? null,
      lcr_aud_tipo_evento: dados.tipoEvento,
      lcr_aud_recurso_evento: dados.recursoEvento ?? null,
      lcr_aud_id_recurso: dados.idRecurso ?? null,
      lcr_aud_endereco_ip: dados.enderecoIp ?? null,
      lcr_aud_id_correlacao: dados.idCorrelacao,
      lcr_aud_detalhes_evento: dados.detalhesEvento ?? null,
    }, { transaction });
  }

  async listar(tipoEvento?: string, limiteResultado = 50, deslocamento = 0) {
    if (!this.banco) return { registros: [], total: 0 };
    const limite = Math.min(100, Math.max(1, Math.floor(limiteResultado)));
    const offset = Math.min(1_000_000, Math.max(0, Math.floor(deslocamento)));
    const where = tipoEvento?.trim() ? { lcr_aud_tipo_evento: { [Op.iLike]: `%${tipoEvento.trim()}%` } } : undefined;
    const resultado = await ModeloRegistroAuditoria.findAndCountAll({
      where,
      order: [['lcr_aud_data_criacao', 'DESC'], ['lcr_aud_id_registro_auditoria', 'DESC']],
      limit: limite,
      offset,
    });
    return { registros: resultado.rows, total: Number(resultado.count) };
  }

  async contar() {
    if (!this.banco) return 0;
    const [resultado] = await this.banco.query<{ quantidade: number }>(
      'SELECT COUNT(*)::int AS quantidade FROM lcr_registros_auditoria',
      { type: QueryTypes.SELECT },
    );
    return Number(resultado?.quantidade ?? 0);
  }
}
