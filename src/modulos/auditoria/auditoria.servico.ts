import { Injectable } from '@nestjs/common';
import { DadosAuditoria, RepositorioAuditoria } from './auditoria.repositorio.js';

const CHAVES_SENSIVEIS = new Set(['token', 'authorization', 'senha', 'segredo', 'access_token', 'refresh_token']);

@Injectable()
export class ServicoAuditoria {
  constructor(private readonly repositorio: RepositorioAuditoria) {}

  private sanitizarDetalhes(detalhes: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!detalhes) return undefined;
    const resultado: Record<string, unknown> = {};
    for (const [chave, valor] of Object.entries(detalhes)) {
      if (CHAVES_SENSIVEIS.has(chave.toLowerCase())) {
        resultado[chave] = '[REDACTED]';
      } else if (typeof valor === 'string') {
        resultado[chave] = valor.slice(0, 2000);
      } else if (typeof valor === 'number' || typeof valor === 'boolean' || valor === null) {
        resultado[chave] = valor;
      } else {
        resultado[chave] = '[OMITIDO]';
      }
    }
    return resultado;
  }

  registrar(dados: DadosAuditoria) {
    if (!dados.tipoEvento.trim() || dados.tipoEvento.length > 100) {
      throw new Error('Tipo de evento de auditoria inválido');
    }
    if (!dados.idCorrelacao.trim() || dados.idCorrelacao.length > 120) {
      throw new Error('Identificador de correlação inválido');
    }
    return this.repositorio.registrar({
      ...dados,
      tipoEvento: dados.tipoEvento.trim(),
      recursoEvento: dados.recursoEvento?.trim().slice(0, 120),
      idCorrelacao: dados.idCorrelacao.trim(),
      detalhesEvento: this.sanitizarDetalhes(dados.detalhesEvento),
    });
  }

  listar(tipoEvento?: string, limiteResultado?: number) {
    return this.repositorio.listar(tipoEvento?.trim(), limiteResultado);
  }
}
