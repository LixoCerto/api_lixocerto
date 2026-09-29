import { Inject, Injectable } from '@nestjs/common';
import { Op, Sequelize } from 'sequelize';
import { ModeloAcaoSustentavel } from '../../infraestrutura/banco/modelos/acao_sustentavel.modelo.js';
import { ModeloDesafio } from '../../infraestrutura/banco/modelos/desafio.modelo.js';
import { ModeloUsuarioDesafio } from '../../infraestrutura/banco/modelos/usuario_desafio.modelo.js';

export type StatusDesafio = 'rascunho' | 'publicado' | 'arquivado';
export interface DadosDesafio {
  nomeDesafio: string;
  descricaoDesafio: string;
  tipoAcao: string;
  metaQuantidade: number;
  quantidadePontos: number;
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
  statusDesafio: string;
  quantidadeProgresso: number;
  statusParticipacao: string;
}

export interface ResultadoRegistroAcao {
  quantidadePontos: number;
  quantidadeProgresso: number;
  desafioConcluido: boolean;
}

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
    const participacoes = idUsuario && desafios.length
      ? await ModeloUsuarioDesafio.findAll({
        where: { lcr_ude_id_usuario: idUsuario, lcr_ude_id_desafio: { [Op.in]: desafios.map(desafio => desafio.lcr_des_id_desafio) } },
      })
      : [];
    const porDesafio = new Map(participacoes.map(participacao => [participacao.lcr_ude_id_desafio, participacao]));
    return desafios.map(desafio => {
      const participacao = porDesafio.get(desafio.lcr_des_id_desafio);
      return {
        idDesafio: desafio.lcr_des_id_desafio,
        nomeDesafio: desafio.lcr_des_nome_desafio,
        descricaoDesafio: desafio.lcr_des_descricao_desafio,
        tipoAcao: desafio.lcr_des_tipo_acao,
        metaQuantidade: desafio.lcr_des_meta_quantidade,
        quantidadePontos: desafio.lcr_des_quantidade_pontos,
        statusDesafio: desafio.lcr_des_status_desafio,
        quantidadeProgresso: participacao?.lcr_ude_quantidade_progresso ?? 0,
        statusParticipacao: participacao?.lcr_ude_status_participacao ?? 'nao_iniciado',
      };
    });
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
    await desafio.update({
      ...dadosParaModelo(dados),
      lcr_des_status_desafio: 'rascunho',
      lcr_des_data_atualizacao: new Date(),
    });
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
    const [participacao] = await ModeloUsuarioDesafio.findOrCreate({
      where: { lcr_ude_id_usuario: idUsuario, lcr_ude_id_desafio: idDesafio },
      defaults: {
        lcr_ude_id_usuario: idUsuario,
        lcr_ude_id_desafio: idDesafio,
        lcr_ude_quantidade_progresso: 0,
        lcr_ude_status_participacao: 'participando',
        lcr_ude_data_inicio: new Date(),
        lcr_ude_data_conclusao: null,
      },
    });
    if (participacao.lcr_ude_status_participacao === 'abandonado') {
      await participacao.update({ lcr_ude_status_participacao: 'participando', lcr_ude_data_conclusao: null });
    }
    return {
      idDesafio: desafio.lcr_des_id_desafio,
      nomeDesafio: desafio.lcr_des_nome_desafio,
      descricaoDesafio: desafio.lcr_des_descricao_desafio,
      tipoAcao: desafio.lcr_des_tipo_acao,
      metaQuantidade: desafio.lcr_des_meta_quantidade,
      quantidadePontos: desafio.lcr_des_quantidade_pontos,
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
      if (!desafio || desafio.lcr_des_tipo_acao !== dados.tipoAcao) {
        await transacao.rollback();
        return null;
      }
      const participacao = await ModeloUsuarioDesafio.findOne({
        where: { lcr_ude_id_usuario: dados.idUsuario, lcr_ude_id_desafio: dados.idDesafio, lcr_ude_status_participacao: 'participando' },
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
      await ModeloAcaoSustentavel.create({
        lcr_ast_id_usuario: dados.idUsuario,
        lcr_ast_id_desafio: dados.idDesafio,
        lcr_ast_tipo_acao: dados.tipoAcao,
        lcr_ast_descricao_acao: dados.descricaoAcao.trim() || null,
        lcr_ast_quantidade_pontos: pontos,
      }, { transaction: transacao });
      await participacao.update({
        lcr_ude_quantidade_progresso: novoProgresso,
        lcr_ude_status_participacao: concluidoAgora ? 'concluido' : 'participando',
        lcr_ude_data_conclusao: concluidoAgora ? new Date() : null,
        lcr_ude_data_atualizacao: new Date(),
      }, { transaction: transacao });
      await transacao.commit();
      return { quantidadePontos: pontos, quantidadeProgresso: novoProgresso, desafioConcluido: concluidoAgora };
    } catch (erro) {
      await transacao.rollback();
      throw erro;
    }
  }
}

function dadosParaModelo(dados: DadosDesafio): Record<string, unknown> {
  return {
    lcr_des_nome_desafio: dados.nomeDesafio,
    lcr_des_descricao_desafio: dados.descricaoDesafio,
    lcr_des_tipo_acao: dados.tipoAcao,
    lcr_des_meta_quantidade: dados.metaQuantidade,
    lcr_des_quantidade_pontos: dados.quantidadePontos,
    lcr_des_data_inicio: dados.dataInicio,
    lcr_des_data_fim: dados.dataFim,
  };
}
