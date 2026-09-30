import { Inject, Injectable } from '@nestjs/common';
import { Op, QueryTypes, Sequelize, Transaction } from 'sequelize';
import { ModeloAcaoSustentavel } from '../../infraestrutura/banco/modelos/acao_sustentavel.modelo.js';
import { ModeloDesafio } from '../../infraestrutura/banco/modelos/desafio.modelo.js';
import { ModeloUsuarioDesafio } from '../../infraestrutura/banco/modelos/usuario_desafio.modelo.js';

export type StatusDesafio = 'rascunho' | 'publicado' | 'arquivado';
export type PeriodicidadeDesafio = 'unica' | 'diaria' | 'semanal' | 'mensal';
export type CriterioDesafio = {
  tipo: 'descarte' | 'quiz' | 'categorias_distintas';
  meta: number;
  categoria?: string;
  tema?: string;
  categorias?: string[];
};
export type ProgressoCriterio = CriterioDesafio & { progresso: number; concluido: boolean };

export interface DadosDesafio {
  nomeDesafio: string;
  descricaoDesafio: string;
  tipoAcao: string;
  metaQuantidade: number;
  quantidadePontos: number;
  periodicidade: PeriodicidadeDesafio;
  criterios: CriterioDesafio[];
  dataInicio: Date;
  dataFim: Date | null;
}
export interface FiltroGestaoDesafios {
  status?: StatusDesafio | 'todos';
  textoPesquisa?: string;
  numeroPagina?: number;
  tamanhoPagina?: number;
}
export interface ResumoDesafio {
  idDesafio: string;
  nomeDesafio: string;
  descricaoDesafio: string;
  tipoAcao: string;
  metaQuantidade: number;
  quantidadePontos: number;
  periodicidade: PeriodicidadeDesafio;
  criterios: CriterioDesafio[];
  progressoCriterios: ProgressoCriterio[];
  periodoChave: string;
  dataFimPeriodo: Date;
  statusDesafio: string;
  quantidadeProgresso: number;
  statusParticipacao: string;
}
export interface ResultadoRegistroAcao {
  quantidadePontos: number;
  quantidadeProgresso: number;
  desafioConcluido: boolean;
  codigoOrigem: string;
}
interface EventoPonto {
  tipo: string;
  categoria: string | null;
  data: Date;
}
interface PeriodoAtual { chave: string; inicio: Date; fim: Date }

@Injectable()
export class RepositorioDesafios {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async listarPublicados(idUsuario: string | null, numeroPagina = 1, tamanhoPagina = 20): Promise<ResumoDesafio[]> {
    if (!this.banco) return [];
    const pagina = Math.max(1, numeroPagina);
    const limite = Math.min(100, Math.max(1, tamanhoPagina));
    const agora = new Date();
    const desafios = await ModeloDesafio.findAll({
      where: {
        lcr_des_status_desafio: 'publicado',
        lcr_des_data_inicio: { [Op.lte]: agora },
        [Op.or]: [{ lcr_des_data_fim: null }, { lcr_des_data_fim: { [Op.gte]: agora } }],
      },
      order: [['lcr_des_data_inicio', 'DESC'], ['lcr_des_nome_desafio', 'ASC']],
      limit: limite,
      offset: (pagina - 1) * limite,
    });
    const periodos = desafios.map(desafio => calcularPeriodo(desafio.lcr_des_periodicidade, agora, desafio.lcr_des_data_inicio, desafio.lcr_des_data_fim));
    const participacoes = idUsuario && desafios.length
      ? await ModeloUsuarioDesafio.findAll({
        where: {
          lcr_ude_id_usuario: idUsuario,
          [Op.or]: desafios.map((desafio, indice) => ({
            lcr_ude_id_desafio: desafio.lcr_des_id_desafio,
            lcr_ude_periodo_chave: periodos[indice]?.chave ?? 'unica',
          })),
        },
      })
      : [];
    const porDesafioPeriodo = new Map(participacoes.map(item => [`${item.lcr_ude_id_desafio}:${item.lcr_ude_periodo_chave}`, item]));
    const inicioEventos = participacoes.length
      ? new Date(Math.min(...periodos.filter((_, indice) => participacoes.some(item => item.lcr_ude_id_desafio === desafios[indice]?.lcr_des_id_desafio)).map(periodo => periodo.inicio.getTime())))
      : agora;
    const eventos = idUsuario && participacoes.length
      ? await this.listarEventos(idUsuario, inicioEventos, agora)
      : [];

    const resultado: ResumoDesafio[] = [];
    for (const [indice, desafio] of desafios.entries()) {
      const periodo = periodos[indice]!;
      const participacao = idUsuario ? porDesafioPeriodo.get(`${desafio.lcr_des_id_desafio}:${periodo.chave}`) : undefined;
      const criterios = normalizarCriterios(desafio.lcr_des_criterios ?? []);
      const progressoCriterios = criterios.map(criterio => ({
        ...criterio,
        progresso: calcularProgressoCriterio(criterio, eventos.filter(evento => {
          const inicioParticipacao = participacao?.lcr_ude_data_inicio?.getTime() ?? Number.POSITIVE_INFINITY;
          return evento.data.getTime() >= Math.max(periodo.inicio.getTime(), inicioParticipacao) && evento.data.getTime() < periodo.fim.getTime();
        })),
        concluido: false,
      }));
      for (const progresso of progressoCriterios) progresso.concluido = progresso.progresso >= progresso.meta;
      const completoPorEventos = criterios.length > 0 && progressoCriterios.every(criterio => criterio.concluido);
      let statusParticipacao = participacao?.lcr_ude_status_participacao ?? 'nao_iniciado';
      let quantidadeProgresso = criterios.length
        ? progressoCriterios.reduce((total, criterio) => total + Math.min(criterio.progresso, criterio.meta), 0)
        : (participacao?.lcr_ude_quantidade_progresso ?? 0);
      if (participacao && completoPorEventos && statusParticipacao === 'participando') {
        await participacao.update({
          lcr_ude_status_participacao: 'concluido',
          lcr_ude_quantidade_progresso: quantidadeProgresso,
          lcr_ude_progresso_criterios: progressoCriterios,
          lcr_ude_data_conclusao: agora,
          lcr_ude_data_atualizacao: agora,
        });
        statusParticipacao = 'concluido';
      } else if (participacao && criterios.length > 0 && statusParticipacao === 'participando') {
        await participacao.update({
          lcr_ude_quantidade_progresso: quantidadeProgresso,
          lcr_ude_progresso_criterios: progressoCriterios,
          lcr_ude_data_atualizacao: agora,
        });
      } else if (participacao) {
        const salvos = participacao.lcr_ude_progresso_criterios ?? [];
        if (salvos.length) quantidadeProgresso = participacao.lcr_ude_quantidade_progresso;
      }
      resultado.push({
        idDesafio: desafio.lcr_des_id_desafio,
        nomeDesafio: desafio.lcr_des_nome_desafio,
        descricaoDesafio: desafio.lcr_des_descricao_desafio,
        tipoAcao: desafio.lcr_des_tipo_acao,
        metaQuantidade: desafio.lcr_des_meta_quantidade,
        quantidadePontos: desafio.lcr_des_quantidade_pontos,
        periodicidade: desafio.lcr_des_periodicidade ?? 'unica',
        criterios,
        progressoCriterios,
        periodoChave: periodo.chave,
        dataFimPeriodo: periodo.fim,
        statusDesafio: desafio.lcr_des_status_desafio,
        quantidadeProgresso,
        statusParticipacao,
      });
    }
    return resultado;
  }

  async listarGestao(filtro: FiltroGestaoDesafios = {}) {
    if (!this.banco) return { desafios: [], quantidadeTotal: 0 };
    const pagina = Math.max(1, filtro.numeroPagina ?? 1);
    const limite = Math.min(100, Math.max(1, filtro.tamanhoPagina ?? 30));
    const where: Record<string, unknown> = {};
    if (filtro.status && filtro.status !== 'todos') where.lcr_des_status_desafio = filtro.status;
    const texto = filtro.textoPesquisa?.trim();
    if (texto) where[Op.or as unknown as string] = [
      { lcr_des_nome_desafio: { [Op.iLike]: `%${texto}%` } },
      { lcr_des_descricao_desafio: { [Op.iLike]: `%${texto}%` } },
      { lcr_des_tipo_acao: { [Op.iLike]: `%${texto}%` } },
    ];
    const resultado = await ModeloDesafio.findAndCountAll({
      where,
      order: [['lcr_des_data_atualizacao', 'DESC'], ['lcr_des_data_criacao', 'DESC']],
      limit: limite,
      offset: (pagina - 1) * limite,
    });
    return { desafios: resultado.rows, quantidadeTotal: resultado.count };
  }

  async criar(dados: DadosDesafio) {
    if (!this.banco) return null;
    const agora = new Date();
    return ModeloDesafio.create({
      ...dadosParaModelo(dados),
      lcr_des_status_desafio: 'rascunho',
      lcr_des_data_criacao: agora,
      lcr_des_data_atualizacao: agora,
    } as any);
  }

  async obter(id: string) {
    return this.banco ? ModeloDesafio.findByPk(id) : null;
  }

  async possuiHistorico(id: string): Promise<boolean> {
    if (!this.banco) return false;
    const [participacoes, acoes] = await Promise.all([
      ModeloUsuarioDesafio.count({ where: { lcr_ude_id_desafio: id } }),
      ModeloAcaoSustentavel.count({ where: { lcr_ast_id_desafio: id } }),
    ]);
    return participacoes > 0 || acoes > 0;
  }

  async atualizar(id: string, dados: DadosDesafio) {
    if (!this.banco) return null;
    const desafio = await ModeloDesafio.findByPk(id);
    if (!desafio || desafio.lcr_des_status_desafio === 'arquivado') return null;
    await desafio.update({ ...dadosParaModelo(dados), lcr_des_status_desafio: 'rascunho', lcr_des_data_atualizacao: new Date() });
    return desafio;
  }

  async alterarStatus(id: string, status: StatusDesafio) {
    if (!this.banco) return null;
    const desafio = await ModeloDesafio.findByPk(id);
    if (!desafio) return null;
    await desafio.update({ lcr_des_status_desafio: status, lcr_des_data_atualizacao: new Date() });
    return desafio;
  }

  async participar(idUsuario: string, idDesafio: string): Promise<ResumoDesafio | null> {
    if (!this.banco) return null;
    const agora = new Date();
    const desafio = await ModeloDesafio.findOne({
      where: {
        lcr_des_id_desafio: idDesafio,
        lcr_des_status_desafio: 'publicado',
        lcr_des_data_inicio: { [Op.lte]: agora },
        [Op.or]: [{ lcr_des_data_fim: null }, { lcr_des_data_fim: { [Op.gte]: agora } }],
      },
    });
    if (!desafio) return null;
    const periodicidade = desafio.lcr_des_periodicidade ?? 'unica';
    const periodo = calcularPeriodo(periodicidade, agora, desafio.lcr_des_data_inicio, desafio.lcr_des_data_fim);
    const [participacao] = await ModeloUsuarioDesafio.findOrCreate({
      where: { lcr_ude_id_usuario: idUsuario, lcr_ude_id_desafio: idDesafio, lcr_ude_periodo_chave: periodo.chave },
      defaults: {
        lcr_ude_id_usuario: idUsuario,
        lcr_ude_id_desafio: idDesafio,
        lcr_ude_periodo_chave: periodo.chave,
        lcr_ude_progresso_criterios: [],
        lcr_ude_quantidade_progresso: 0,
        lcr_ude_status_participacao: 'participando',
        lcr_ude_data_inicio: agora,
        lcr_ude_data_conclusao: null,
      },
    });
    if (participacao.lcr_ude_status_participacao !== 'participando') return null;
    const criterios = normalizarCriterios(desafio.lcr_des_criterios ?? []);
    return {
      idDesafio: desafio.lcr_des_id_desafio,
      nomeDesafio: desafio.lcr_des_nome_desafio,
      descricaoDesafio: desafio.lcr_des_descricao_desafio,
      tipoAcao: desafio.lcr_des_tipo_acao,
      metaQuantidade: desafio.lcr_des_meta_quantidade,
      quantidadePontos: desafio.lcr_des_quantidade_pontos,
      periodicidade,
      criterios,
      progressoCriterios: (participacao.lcr_ude_progresso_criterios ?? []) as ProgressoCriterio[],
      periodoChave: periodo.chave,
      dataFimPeriodo: periodo.fim,
      statusDesafio: desafio.lcr_des_status_desafio,
      quantidadeProgresso: participacao.lcr_ude_quantidade_progresso,
      statusParticipacao: participacao.lcr_ude_status_participacao,
    };
  }

  async registrarAcao(dados: { idUsuario: string; idDesafio: string; tipoAcao: string; descricaoAcao: string }): Promise<ResultadoRegistroAcao | null> {
    if (!this.banco) return null;
    const transacao = await this.banco.transaction();
    try {
      const agora = new Date();
      const desafio = await ModeloDesafio.findOne({
        where: {
          lcr_des_id_desafio: dados.idDesafio,
          lcr_des_status_desafio: 'publicado',
          lcr_des_data_inicio: { [Op.lte]: agora },
          [Op.or]: [{ lcr_des_data_fim: null }, { lcr_des_data_fim: { [Op.gte]: agora } }],
        },
        transaction: transacao,
        lock: transacao.LOCK.UPDATE,
      });
      if (!desafio || desafio.lcr_des_tipo_acao !== dados.tipoAcao || normalizarCriterios(desafio.lcr_des_criterios ?? []).length > 0) {
        await transacao.rollback();
        return null;
      }
      const periodo = calcularPeriodo(desafio.lcr_des_periodicidade ?? 'unica', agora, desafio.lcr_des_data_inicio, desafio.lcr_des_data_fim);
      const participacao = await ModeloUsuarioDesafio.findOne({
        where: {
          lcr_ude_id_usuario: dados.idUsuario,
          lcr_ude_id_desafio: dados.idDesafio,
          lcr_ude_periodo_chave: periodo.chave,
          lcr_ude_status_participacao: 'participando',
        },
        transaction: transacao,
        lock: transacao.LOCK.UPDATE,
      });
      if (!participacao) {
        await transacao.rollback();
        return null;
      }
      const novoProgresso = Math.min(desafio.lcr_des_meta_quantidade, participacao.lcr_ude_quantidade_progresso + 1);
      const concluidoAgora = novoProgresso >= desafio.lcr_des_meta_quantidade;
      const pontos = concluidoAgora ? desafio.lcr_des_quantidade_pontos : 0;
      const acao = await ModeloAcaoSustentavel.create({
        lcr_ast_id_usuario: dados.idUsuario,
        lcr_ast_id_desafio: dados.idDesafio,
        lcr_ast_tipo_acao: dados.tipoAcao,
        lcr_ast_descricao_acao: dados.descricaoAcao.trim() || null,
        lcr_ast_quantidade_pontos: pontos,
      }, { transaction: transacao });
      await participacao.update({
        lcr_ude_quantidade_progresso: novoProgresso,
        lcr_ude_status_participacao: concluidoAgora ? 'concluido' : 'participando',
        lcr_ude_data_conclusao: concluidoAgora ? agora : null,
        lcr_ude_data_atualizacao: agora,
      }, { transaction: transacao });
      await transacao.commit();
      return { quantidadePontos: pontos, quantidadeProgresso: novoProgresso, desafioConcluido: concluidoAgora, codigoOrigem: acao.lcr_ast_id_acao_sustentavel };
    } catch (erro) {
      await transacao.rollback();
      throw erro;
    }
  }

  private async listarEventos(idUsuario: string, inicio: Date, fim: Date): Promise<EventoPonto[]> {
    if (!this.banco) return [];
    const linhas = await this.banco.query<{ tipo: string; categoria: string | null; data: Date }>(
      `SELECT lcr_evp_tipo_origem AS tipo,
              lcr_evp_categoria AS categoria,
              lcr_evp_data_registro AS data
       FROM lcr_eventos_pontos
       WHERE lcr_evp_id_usuario = :idUsuario
         AND lcr_evp_tipo_origem IN ('descarte_validado', 'quiz_correto')
         AND lcr_evp_data_registro >= :inicio
         AND lcr_evp_data_registro < :fim`,
      { replacements: { idUsuario, inicio, fim }, type: QueryTypes.SELECT },
    );
    return linhas.map(linha => ({ ...linha, data: new Date(linha.data) }));
  }
}

function dadosParaModelo(dados: DadosDesafio): Record<string, unknown> {
  return {
    lcr_des_nome_desafio: dados.nomeDesafio,
    lcr_des_descricao_desafio: dados.descricaoDesafio,
    lcr_des_tipo_acao: dados.tipoAcao,
    lcr_des_meta_quantidade: dados.metaQuantidade,
    lcr_des_quantidade_pontos: dados.quantidadePontos,
    lcr_des_periodicidade: dados.periodicidade,
    lcr_des_criterios: dados.criterios,
    lcr_des_data_inicio: dados.dataInicio,
    lcr_des_data_fim: dados.dataFim,
  };
}

function normalizarCriterios(value: unknown): CriterioDesafio[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => item as CriterioDesafio);
}

function calcularProgressoCriterio(criterio: CriterioDesafio, eventos: EventoPonto[]): number {
  if (criterio.tipo === 'descarte') {
    const categoria = normalizar(criterio.categoria ?? '');
    return eventos.filter(evento => evento.tipo === 'descarte_validado' && normalizar(evento.categoria ?? '') === categoria).length;
  }
  if (criterio.tipo === 'quiz') {
    const tema = normalizar(criterio.tema ?? '');
    return eventos.filter(evento => evento.tipo === 'quiz_correto' && (!tema || normalizar(evento.categoria ?? '') === tema)).length;
  }
  const categoriasPermitidas = new Set((criterio.categorias ?? []).map(normalizar));
  const categorias = new Set(eventos
    .filter(evento => evento.tipo === 'descarte_validado' && evento.categoria)
    .map(evento => normalizar(evento.categoria!))
    .filter(categoria => !categoriasPermitidas.size || categoriasPermitidas.has(categoria)));
  return categorias.size;
}

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

function calcularPeriodo(periodicidade: string, agora: Date, dataInicio: Date, dataFim: Date | null): PeriodoAtual {
  if (periodicidade === 'unica') {
    return { chave: 'unica', inicio: new Date(dataInicio), fim: dataFim ? new Date(dataFim.getTime() + 1) : new Date('9999-12-31T23:59:59.999Z') };
  }
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(agora);
  const valor = (tipo: string) => Number(partes.find(parte => parte.type === tipo)?.value ?? 0);
  const ano = valor('year');
  const mes = valor('month');
  const dia = valor('day');
  let inicioLocal = new Date(Date.UTC(ano, mes - 1, dia));
  let chave = '';
  if (periodicidade === 'diaria') {
    chave = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  } else if (periodicidade === 'semanal') {
    const deslocamento = (inicioLocal.getUTCDay() + 6) % 7;
    inicioLocal = new Date(inicioLocal.getTime() - deslocamento * 86400000);
    const quinta = new Date(inicioLocal.getTime() + 3 * 86400000);
    const anoIso = quinta.getUTCFullYear();
    const quatroDeJaneiro = new Date(Date.UTC(anoIso, 0, 4));
    const primeiraSegunda = new Date(quatroDeJaneiro.getTime() - ((quatroDeJaneiro.getUTCDay() + 6) % 7) * 86400000);
    const semanaIso = Math.floor((inicioLocal.getTime() - primeiraSegunda.getTime()) / (7 * 86400000)) + 1;
    chave = `${anoIso}-W${String(semanaIso).padStart(2, '0')}`;
  } else {
    inicioLocal = new Date(Date.UTC(ano, mes - 1, 1));
    chave = `${ano}-${String(mes).padStart(2, '0')}`;
  }
  const inicioUTC = new Date(inicioLocal.getTime() + 3 * 60 * 60 * 1000);
  const duracaoDias = periodicidade === 'diaria' ? 1 : periodicidade === 'semanal' ? 7 : 31;
  const fimUTC = periodicidade === 'mensal'
    ? new Date(Date.UTC(ano, mes, 1) + 3 * 60 * 60 * 1000)
    : new Date(inicioUTC.getTime() + duracaoDias * 86400000);
  const inicio = new Date(Math.max(inicioUTC.getTime(), dataInicio.getTime()));
  const fim = new Date(Math.min(fimUTC.getTime(), dataFim ? dataFim.getTime() + 1 : fimUTC.getTime()));
  return { chave, inicio, fim };
}
