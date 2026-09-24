import { Injectable } from '@nestjs/common';
import { ServicoAuditoria } from '../auditoria/auditoria.servico.js';
import { ServicoGamificacao } from '../gamificacao/gamificacao.servico.js';
import { RepositorioDesafios, ResultadoRegistroAcao } from './desafios.repositorio.js';

@Injectable()
export class ServicoDesafios {
  constructor(
    private readonly repositorio: RepositorioDesafios,
    private readonly gamificacao: ServicoGamificacao,
    private readonly auditoria: ServicoAuditoria,
  ) {}

  listar(idUsuario: string | null, numeroPagina?: number, tamanhoPagina?: number) {
    return this.repositorio.listarPublicados(idUsuario, numeroPagina, tamanhoPagina);
  }

  async participar(idUsuario: string, idDesafio: string, idCorrelacao: string) {
    const desafio = await this.repositorio.participar(idUsuario, idDesafio);
    if (!desafio) return null;
    await this.auditoria.registrar({
      idUsuario,
      tipoEvento: 'desafio_participacao_iniciada',
      recursoEvento: 'desafio',
      idRecurso: idDesafio,
      idCorrelacao,
      detalhesEvento: { idDesafio },
    });
    return desafio;
  }

  async registrarAcao(idUsuario: string, dados: { idDesafio: string; tipoAcao: string; descricaoAcao: string }, idCorrelacao: string): Promise<ResultadoRegistroAcao | null> {
    const resultado = await this.repositorio.registrarAcao({ idUsuario, ...dados });
    if (!resultado) return null;
    if (resultado.quantidadePontos > 0) {
      await this.gamificacao.concederPontos(idUsuario, resultado.quantidadePontos);
    }
    await this.auditoria.registrar({
      idUsuario,
      tipoEvento: resultado.desafioConcluido ? 'desafio_concluido' : 'acao_sustentavel_registrada',
      recursoEvento: 'desafio',
      idRecurso: dados.idDesafio,
      idCorrelacao,
      detalhesEvento: { tipoAcao: dados.tipoAcao, quantidadeProgresso: resultado.quantidadeProgresso },
    });
    return resultado;
  }
}
