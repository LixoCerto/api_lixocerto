import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ServicoAuditoria } from '../auditoria/auditoria.servico.js';
import { ServicoGamificacao } from '../gamificacao/gamificacao.servico.js';
import { DadosDesafio, RepositorioDesafios, ResultadoRegistroAcao, StatusDesafio } from './desafios.repositorio.js';

const statusValidos = new Set<StatusDesafio>(['rascunho', 'publicado', 'arquivado']);

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

  listarGestao(filtro: { status?: StatusDesafio | 'todos'; textoPesquisa?: string; numeroPagina?: number; tamanhoPagina?: number }) {
    return this.repositorio.listarGestao(filtro);
  }

  obter(id: string) {
    return this.repositorio.obter(id);
  }

  criar(dados: DadosDesafio) {
    return this.repositorio.criar(validarDados(dados));
  }

  async atualizar(id: string, dados: DadosDesafio) {
    if (await this.repositorio.possuiHistorico(id)) {
      throw new ConflictException('Este desafio já possui participantes ou ações. Arquive-o e crie outro para preservar o histórico.');
    }
    return this.repositorio.atualizar(id, validarDados(dados));
  }

  async alterarStatus(id: string, status: string) {
    if (!statusValidos.has(status as StatusDesafio)) throw new BadRequestException('Status de desafio inválido');
    if (status === 'publicado') {
      const desafio = await this.repositorio.obter(id);
      if (!desafio) return null;
      if (desafio.lcr_des_data_fim && desafio.lcr_des_data_fim.getTime() < Date.now()) {
        throw new BadRequestException('A data final do desafio já passou');
      }
    }
    return this.repositorio.alterarStatus(id, status as StatusDesafio);
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
    if (resultado.quantidadePontos > 0) await this.gamificacao.concederPontos(idUsuario, resultado.quantidadePontos);
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

function validarDados(dados: DadosDesafio): DadosDesafio {
  const nomeDesafio = dados.nomeDesafio?.trim();
  const descricaoDesafio = dados.descricaoDesafio?.trim();
  const tipoAcao = dados.tipoAcao?.trim();
  if (!nomeDesafio || nomeDesafio.length > 160) throw new BadRequestException('Nome obrigatório, com até 160 caracteres');
  if (!descricaoDesafio || descricaoDesafio.length > 8000) throw new BadRequestException('Descrição obrigatória, com até 8000 caracteres');
  if (!tipoAcao || tipoAcao.length > 100 || !/^[a-z0-9_]+$/.test(tipoAcao)) throw new BadRequestException('Use um identificador de ação em minúsculas, números e sublinhado');
  if (!Number.isInteger(dados.metaQuantidade) || dados.metaQuantidade < 1 || dados.metaQuantidade > 100000) throw new BadRequestException('A meta deve ser um inteiro entre 1 e 100000');
  if (!Number.isInteger(dados.quantidadePontos) || dados.quantidadePontos < 0 || dados.quantidadePontos > 100000) throw new BadRequestException('A recompensa deve ser um inteiro entre 0 e 100000');
  const dataInicio = dados.dataInicio instanceof Date ? dados.dataInicio : new Date(dados.dataInicio);
  const dataFim = dados.dataFim ? (dados.dataFim instanceof Date ? dados.dataFim : new Date(dados.dataFim)) : null;
  if (!Number.isFinite(dataInicio.getTime())) throw new BadRequestException('Data de início inválida');
  if (dataFim && (!Number.isFinite(dataFim.getTime()) || dataFim.getTime() < dataInicio.getTime())) throw new BadRequestException('A data final deve ser válida e posterior à data inicial');
  return { nomeDesafio, descricaoDesafio, tipoAcao, metaQuantidade: dados.metaQuantidade, quantidadePontos: dados.quantidadePontos, dataInicio, dataFim };
}
