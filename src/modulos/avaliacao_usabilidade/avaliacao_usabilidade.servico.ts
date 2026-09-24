import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RepositorioAvaliacaoUsabilidade } from './avaliacao_usabilidade.repositorio.js';

@Injectable()
export class ServicoAvaliacaoUsabilidade {
  constructor(private readonly repositorio: RepositorioAvaliacaoUsabilidade) {}

  calcularPontuacao(notasItens: number[]): number | null {
    if (notasItens.length !== 10 || notasItens.some(nota => nota < 1 || nota > 5 || !Number.isInteger(nota))) {
      return null;
    }
    const soma = notasItens.reduce((total, nota, indice) => total + (indice % 2 === 0 ? nota - 1 : 5 - nota), 0);
    return Math.round(soma * 2.5);
  }

  async enviar(codigoParticipante: string, indicaConsentimento: boolean, notasItens: number[]) {
    if (!indicaConsentimento) {
      return { avaliacaoAceita: false, pontuacaoSus: 0, mensagemResultado: 'Consentimento obrigatorio.' };
    }
    const pontuacaoSus = this.calcularPontuacao(notasItens);
    if (pontuacaoSus === null || !codigoParticipante.trim()) {
      return { avaliacaoAceita: false, pontuacaoSus: 0, mensagemResultado: 'A escala SUS exige dez notas inteiras entre 1 e 5 e um codigo anonimo.' };
    }

    const segredo = process.env.SEGREDO_HASH_PARTICIPANTE;
    if (!segredo) {
      return { avaliacaoAceita: false, pontuacaoSus: 0, mensagemResultado: 'Avaliacao indisponivel ate configurar o segredo de anonimização.' };
    }
    const hashParticipante = createHash('sha256').update(`${segredo}:${codigoParticipante.trim()}`).digest('hex');
    await this.repositorio.salvar(hashParticipante, notasItens, pontuacaoSus);
    return { avaliacaoAceita: true, pontuacaoSus, mensagemResultado: 'Avaliacao registrada sem armazenar o codigo do participante.' };
  }

  obterResultadosAgregados() {
    return this.repositorio.obterResultadosAgregados();
  }
}
