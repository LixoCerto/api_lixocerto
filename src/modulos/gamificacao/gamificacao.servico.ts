import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Transaction } from 'sequelize';
import { ProgressoGamificacao, RepositorioProgresso, TipoOrigemPontos } from './progresso.repositorio.js';

export type NivelGamificacao = 'iniciante' | 'explorador' | 'reciclador' | 'agente_ambiental' | 'guerreiro_ecologico';

@Injectable()
export class ServicoGamificacao {
  constructor(private readonly progresso: RepositorioProgresso) {}

  calcularNivel(quantidadePontos: number): NivelGamificacao {
    if (quantidadePontos >= 4000) return 'guerreiro_ecologico';
    if (quantidadePontos >= 2000) return 'agente_ambiental';
    if (quantidadePontos >= 1000) return 'reciclador';
    if (quantidadePontos >= 500) return 'explorador';
    return 'iniciante';
  }

  aplicarPontos(quantidadePontosAtual: number, quantidadePontosConcedidos: number) {
    const quantidadePontos = Math.max(0, quantidadePontosAtual + quantidadePontosConcedidos);
    return { quantidadePontos, nivelGamificacao: this.calcularNivel(quantidadePontos) };
  }

  obterProgresso(idUsuario: string): Promise<ProgressoGamificacao> {
    return this.progresso.obter(idUsuario);
  }

  obterRanking(limiteResultado?: number) {
    return this.progresso.ranking(limiteResultado);
  }

  concederPontos(
    idUsuario: string,
    quantidadePontosConcedidos: number,
    tipoOrigem: TipoOrigemPontos = 'ajuste',
    codigoOrigem: string = randomUUID(),
    categoria?: string,
    transacao?: Transaction,
  ) {
    return this.progresso.registrarEvento({
      idUsuario,
      quantidadePontos: quantidadePontosConcedidos,
      tipoOrigem,
      codigoOrigem,
      categoria,
      transacao,
    });
  }
}
