import { Injectable } from '@nestjs/common';
import { RepositorioProgresso } from './progresso.repositorio.js';

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
    return {
      quantidadePontos,
      nivelGamificacao: this.calcularNivel(quantidadePontos),
    };
  }

  obterProgresso(idUsuario: string) {
    return this.progresso.obter(idUsuario);
  }

  async concederPontos(idUsuario: string, quantidadePontosConcedidos: number) {
    const atual = await this.progresso.obter(idUsuario);
    const novo = this.aplicarPontos(atual.quantidadePontos, quantidadePontosConcedidos);
    await this.progresso.atualizar(idUsuario, novo);
    return { ...atual, ...novo };
  }
}
