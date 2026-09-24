import { Inject, Injectable } from '@nestjs/common';
import { Op, Sequelize } from 'sequelize';
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

  async registrar(dados: DadosAuditoria) {
    if (!this.banco) return null;
    return ModeloRegistroAuditoria.create({
      lcr_aud_id_usuario: dados.idUsuario ?? null,
      lcr_aud_tipo_evento: dados.tipoEvento,
      lcr_aud_recurso_evento: dados.recursoEvento ?? null,
      lcr_aud_id_recurso: dados.idRecurso ?? null,
      lcr_aud_endereco_ip: dados.enderecoIp ?? null,
      lcr_aud_id_correlacao: dados.idCorrelacao,
      lcr_aud_detalhes_evento: dados.detalhesEvento ?? null,
    });
  }

  async listar(tipoEvento?: string, limiteResultado = 100) {
    if (!this.banco) return [];
    const limite = Math.min(500, Math.max(1, limiteResultado));
    return ModeloRegistroAuditoria.findAll({
      where: tipoEvento ? { lcr_aud_tipo_evento: { [Op.eq]: tipoEvento } } : undefined,
      order: [['lcr_aud_data_criacao', 'DESC']],
      limit: limite,
    });
  }
}
