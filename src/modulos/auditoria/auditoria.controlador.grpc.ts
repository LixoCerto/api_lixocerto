import { Metadata } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ServicoAutenticacao } from '../autenticacao/autenticacao.servico.js';
import { ServicoAutorizacao } from '../autorizacao/autorizacao.servico.js';
import { ServicoUsuarios } from '../usuarios/usuarios.servico.js';
import { ServicoAuditoria } from './auditoria.servico.js';

interface RespostaRegistroAuditoria {
  evento_aceito: boolean;
  id_registro_auditoria: string;
}

interface ItemAuditoriaGrpc {
  id_registro_auditoria: string;
  tipo_evento: string;
  recurso_evento: string;
  id_correlacao: string;
  detalhes_evento_json: string;
  data_criacao: string;
}

@Controller()
export class ControladorGrpcAuditoria {
  constructor(
    private readonly servico: ServicoAuditoria,
    private readonly autenticacao: ServicoAutenticacao,
    private readonly autorizacao: ServicoAutorizacao,
    private readonly usuarios: ServicoUsuarios,
  ) {}

  private async obterContexto(metadados: Metadata) {
    const valor = metadados.get('authorization')[0];
    const autorizacao = Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
    const identidade = await this.autenticacao.obterIdentidadeAtual(autorizacao);
    const idUsuario = await this.usuarios.obterIdInterno(identidade.idExterno);
    return { identidade, idUsuario };
  }

  @GrpcMethod('ServicoAuditoria', 'RegistrarEventoAuditoria')
  async registrarEventoAuditoria(requisicao: {
    tipo_evento?: string;
    recurso_evento?: string;
    id_recurso?: string;
    endereco_ip?: string;
    id_correlacao?: string;
    detalhes_evento_json?: string;
  }, metadados: Metadata): Promise<RespostaRegistroAuditoria> {
    const { idUsuario } = await this.obterContexto(metadados);
    let detalhes: Record<string, unknown> | undefined;
    if (requisicao.detalhes_evento_json?.trim()) {
      try {
        const valor = JSON.parse(requisicao.detalhes_evento_json);
        if (valor && typeof valor === 'object' && !Array.isArray(valor)) detalhes = valor as Record<string, unknown>;
      } catch {
        detalhes = { erro_formato_detalhes: true };
      }
    }
    const registro = await this.servico.registrar({
      idUsuario,
      tipoEvento: requisicao.tipo_evento ?? '',
      recursoEvento: requisicao.recurso_evento,
      idRecurso: requisicao.id_recurso,
      enderecoIp: requisicao.endereco_ip,
      idCorrelacao: requisicao.id_correlacao ?? '',
      detalhesEvento: detalhes,
    });
    return {
      evento_aceito: Boolean(registro),
      id_registro_auditoria: registro?.lcr_aud_id_registro_auditoria ?? '',
    };
  }

  @GrpcMethod('ServicoAuditoria', 'ListarAuditoria')
  async listarAuditoria(requisicao: { tipo_evento?: string; limite_resultado?: number }, metadados: Metadata): Promise<{ registros: ItemAuditoriaGrpc[] }> {
    const { identidade } = await this.obterContexto(metadados);
    this.autorizacao.exigirPermissao(identidade, 'auditoria:consultar');
    const registros = await this.servico.listar(requisicao.tipo_evento, requisicao.limite_resultado);
    return {
      registros: registros.map(registro => ({
        id_registro_auditoria: registro.lcr_aud_id_registro_auditoria,
        tipo_evento: registro.lcr_aud_tipo_evento,
        recurso_evento: registro.lcr_aud_recurso_evento ?? '',
        id_correlacao: registro.lcr_aud_id_correlacao,
        detalhes_evento_json: registro.lcr_aud_detalhes_evento ? JSON.stringify(registro.lcr_aud_detalhes_evento) : '{}',
        data_criacao: registro.lcr_aud_data_criacao.toISOString(),
      })),
    };
  }
}
