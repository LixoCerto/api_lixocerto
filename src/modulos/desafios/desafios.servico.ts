import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ServicoAuditoria } from '../auditoria/auditoria.servico.js';
import { ServicoGamificacao } from '../gamificacao/gamificacao.servico.js';
import {
  CriterioDesafio,
  DadosDesafio,
  PeriodicidadeDesafio,
  RepositorioDesafios,
  ResultadoRegistroAcao,
  StatusDesafio,
} from './desafios.repositorio.js';

const statusValidos = new Set<StatusDesafio>(['rascunho', 'publicado', 'arquivado']);
const periodicidadesValidas = new Set<PeriodicidadeDesafio>(['unica', 'diaria', 'semanal', 'mensal']);

@Injectable()
export class ServicoDesafios {
  constructor(
    private readonly repositorio: RepositorioDesafios,
    private readonly gamificacao: ServicoGamificacao,
    private readonly auditoria: ServicoAuditoria,
  ) {}

  async listar(idUsuario: string | null, numeroPagina?: number, tamanhoPagina?: number) {
    const desafios = await this.repositorio.listarPublicados(idUsuario, numeroPagina, tamanhoPagina);
    if (idUsuario) await this.concederRecompensasConcluidas(idUsuario, desafios);
    return desafios.filter(desafio => desafio.statusParticipacao !== 'concluido');
  }

  async processarProgresso(idUsuario: string) {
    const desafios = await this.repositorio.listarPublicados(idUsuario, 1, 100);
    await this.concederRecompensasConcluidas(idUsuario, desafios);
  }

  private async concederRecompensasConcluidas(idUsuario: string, desafios: Awaited<ReturnType<RepositorioDesafios['listarPublicados']>>) {
    for (const desafio of desafios) {
      if (desafio.statusParticipacao === 'concluido' && desafio.criterios.length > 0) {
        await this.gamificacao.concederPontos(
          idUsuario,
          desafio.quantidadePontos,
          'desafio_concluido',
          `${desafio.idDesafio}:${desafio.periodoChave}`,
        );
      }
    }
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
      detalhesEvento: { idDesafio, periodoChave: desafio.periodoChave },
    });
    return desafio;
  }

  async registrarAcao(idUsuario: string, dados: { idDesafio: string; tipoAcao: string; descricaoAcao: string }, idCorrelacao: string): Promise<ResultadoRegistroAcao | null> {
    const resultado = await this.repositorio.registrarAcao({ idUsuario, ...dados });
    if (!resultado) return null;
    if (resultado.quantidadePontos > 0) {
      await this.gamificacao.concederPontos(idUsuario, resultado.quantidadePontos, 'desafio_concluido', resultado.codigoOrigem);
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

function validarDados(dados: DadosDesafio): DadosDesafio {
  const nomeDesafio = dados.nomeDesafio?.trim();
  const descricaoDesafio = dados.descricaoDesafio?.trim();
  const tipoAcao = dados.tipoAcao?.trim();
  if (!nomeDesafio || nomeDesafio.length > 160) throw new BadRequestException('Nome obrigatório, com até 160 caracteres');
  if (!descricaoDesafio || descricaoDesafio.length > 8000) throw new BadRequestException('Descrição obrigatória, com até 8000 caracteres');
  if (!tipoAcao || tipoAcao.length > 100 || !/^[a-z0-9_]+$/.test(tipoAcao)) throw new BadRequestException('Use um identificador de ação em minúsculas, números e sublinhado');
  if (!Number.isInteger(dados.metaQuantidade) || dados.metaQuantidade < 1 || dados.metaQuantidade > 100000) throw new BadRequestException('A meta deve ser um inteiro entre 1 e 100000');
  if (!Number.isInteger(dados.quantidadePontos) || dados.quantidadePontos < 0 || dados.quantidadePontos > 100000) throw new BadRequestException('A recompensa deve ser um inteiro entre 0 e 100000');
  const periodicidade = dados.periodicidade ?? 'unica';
  if (!periodicidadesValidas.has(periodicidade)) throw new BadRequestException('Periodicidade de desafio inválida');
  const criterios = validarCriterios(dados.criterios ?? []);
  const metaQuantidade = criterios.length ? criterios.reduce((total, criterio) => total + criterio.meta, 0) : dados.metaQuantidade;
  const dataInicio = dados.dataInicio instanceof Date ? dados.dataInicio : new Date(dados.dataInicio);
  const dataFim = dados.dataFim ? (dados.dataFim instanceof Date ? dados.dataFim : new Date(dados.dataFim)) : null;
  if (!Number.isFinite(dataInicio.getTime())) throw new BadRequestException('Data de início inválida');
  if (dataFim && (!Number.isFinite(dataFim.getTime()) || dataFim.getTime() < dataInicio.getTime())) throw new BadRequestException('A data final deve ser válida e posterior à data inicial');
  return { nomeDesafio, descricaoDesafio, tipoAcao, metaQuantidade, quantidadePontos: dados.quantidadePontos, periodicidade, criterios, dataInicio, dataFim };
}

function validarCriterios(criterios: CriterioDesafio[]): CriterioDesafio[] {
  if (!Array.isArray(criterios) || criterios.length > 8) throw new BadRequestException('Configure até oito critérios por desafio');
  return criterios.map(criterio => {
    if (!['descarte', 'quiz', 'categorias_distintas'].includes(criterio.tipo)) throw new BadRequestException('Tipo de critério inválido');
    if (!Number.isInteger(criterio.meta) || criterio.meta < 1 || criterio.meta > 100000) throw new BadRequestException('Cada meta deve ser um inteiro positivo');
    const categoria = criterio.categoria?.trim();
    const tema = criterio.tema?.trim();
    const categorias = Array.isArray(criterio.categorias)
      ? [...new Set(criterio.categorias.map(item => item.trim()).filter(Boolean))]
      : [];
    if (criterio.tipo === 'descarte' && (!categoria || categoria.length > 80)) throw new BadRequestException('Critério de descarte exige categoria de material');
    if (criterio.tipo === 'quiz' && tema && tema.length > 80) throw new BadRequestException('Tema de quiz deve ter até 80 caracteres');
    if (criterio.tipo === 'categorias_distintas' && categorias.some(item => item.length > 80)) throw new BadRequestException('Categorias permitidas devem ter até 80 caracteres');
    return { tipo: criterio.tipo, meta: criterio.meta, ...(categoria ? { categoria } : {}), ...(tema ? { tema } : {}), ...(categorias.length ? { categorias } : {}) };
  });
}
