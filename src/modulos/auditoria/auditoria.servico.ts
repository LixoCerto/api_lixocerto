import { Injectable } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { DadosAuditoria, RepositorioAuditoria } from './auditoria.repositorio.js';

const CHAVES_SENSIVEIS = /(token|authorization|senha|password|segredo|secret|credential|api.?key|private.?key)/i;
const MAX_PROFUNDIDADE = 4;
const MAX_ITENS_ARRAY = 50;

@Injectable()
export class ServicoAuditoria {
  constructor(private readonly repositorio: RepositorioAuditoria) {}

  private sanitizarValor(valor: unknown, profundidade = 0): unknown {
    if (profundidade >= MAX_PROFUNDIDADE) return '[LIMITE_PROFUNDIDADE]';
    if (typeof valor === 'string') return valor.slice(0, 2000);
    if (typeof valor === 'number' || typeof valor === 'boolean' || valor === null) return valor;
    if (Array.isArray(valor)) return valor.slice(0, MAX_ITENS_ARRAY).map((item) => this.sanitizarValor(item, profundidade + 1));
    if (valor && typeof valor === 'object') {
      const resultado: Record<string, unknown> = {};
      for (const [chave, item] of Object.entries(valor as Record<string, unknown>).slice(0, MAX_ITENS_ARRAY)) {
        resultado[chave] = CHAVES_SENSIVEIS.test(chave) ? '[REDACTED]' : this.sanitizarValor(item, profundidade + 1);
      }
      return resultado;
    }
    return '[OMITIDO]';
  }

  private sanitizarDetalhes(detalhes: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!detalhes) return undefined;
    const resultado = this.sanitizarValor(detalhes);
    return resultado && typeof resultado === 'object' && !Array.isArray(resultado)
      ? resultado as Record<string, unknown>
      : undefined;
  }

  registrar(dados: DadosAuditoria, transaction?: Transaction) {
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
    }, transaction);
  }

  listar(tipoEvento?: string, limiteResultado?: number, deslocamento?: number) {
    return this.repositorio.listar(tipoEvento?.trim(), limiteResultado, deslocamento);
  }
}
