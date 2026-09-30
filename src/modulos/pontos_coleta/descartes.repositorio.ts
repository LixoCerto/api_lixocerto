import { Inject, Injectable } from '@nestjs/common';
import { QueryTypes, Sequelize, Transaction } from 'sequelize';
import { ModeloPontoColeta } from '../../infraestrutura/banco/modelos/ponto_coleta.modelo.js';

export type StatusRegistroDescarte = 'pendente' | 'aprovado' | 'rejeitado';
export interface RegistroDescarte {
  idRegistro: string;
  idUsuario?: string;
  identificadorParticipante?: string;
  idPontoColeta: string;
  nomePontoColeta: string;
  cidadePontoColeta: string;
  categoriaMaterial: string;
  quantidade: number;
  relato: string;
  status: StatusRegistroDescarte;
  dataRegistro: string;
  dataRevisao: string;
  pontosConcedidos: number;
}

@Injectable()
export class RepositorioDescartes {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async registrar(dados: { idUsuario: string; idPontoColeta: string; categoria: string; relato: string }) {
    if (!this.banco) return null;
    return this.banco.transaction(async transaction => {
      const ponto = await ModeloPontoColeta.findOne({
        where: { lcr_pco_id_ponto_coleta: dados.idPontoColeta, lcr_pco_status_verificacao: 'verificado' },
        transaction,
        lock: transaction.LOCK.SHARE,
      });
      if (!ponto || !aceitaCategoria(ponto.lcr_pco_categorias_aceitas, dados.categoria)) return null;
      await this.banco!.query('SELECT pg_advisory_xact_lock(hashtextextended(:idUsuario, 0))', {
        replacements: { idUsuario: dados.idUsuario }, transaction,
      });
      const recentes = await this.banco!.query<{ quantidade: number; repetidos: number }>(
        `SELECT COUNT(*)::integer AS quantidade,
                COUNT(*) FILTER (
                  WHERE lcr_rde_id_ponto_coleta = :idPontoColeta
                    AND LOWER(lcr_rde_categoria_material) = LOWER(:categoria)
                )::integer AS repetidos
         FROM lcr_registros_descartes
         WHERE lcr_rde_id_usuario = :idUsuario
           AND lcr_rde_data_registro >= CURRENT_TIMESTAMP - INTERVAL '24 hours'`,
        { replacements: { idUsuario: dados.idUsuario, idPontoColeta: dados.idPontoColeta, categoria: dados.categoria }, type: QueryTypes.SELECT, transaction },
      );
      if (Number(recentes[0]?.quantidade ?? 0) >= 10 || Number(recentes[0]?.repetidos ?? 0) > 0) return null;
      const registros = await this.banco!.query<Record<string, unknown>>(
        `INSERT INTO lcr_registros_descartes
           (lcr_rde_id_usuario, lcr_rde_id_ponto_coleta, lcr_rde_categoria_material, lcr_rde_relato)
         VALUES (:idUsuario, :idPontoColeta, :categoria, :relato)
         RETURNING lcr_rde_id_registro_descarte AS "idRegistro",
                   lcr_rde_id_ponto_coleta AS "idPontoColeta",
                   lcr_rde_categoria_material AS "categoriaMaterial",
                   lcr_rde_status AS status,
                   lcr_rde_data_registro AS "dataRegistro"`,
        { replacements: { idUsuario: dados.idUsuario, idPontoColeta: dados.idPontoColeta, categoria: dados.categoria, relato: dados.relato || null }, type: QueryTypes.SELECT, transaction },
      );
      const registro = registros[0];
      if (!registro) return null;
      return {
        ...(registro as any),
        nomePontoColeta: ponto.lcr_pco_nome_ponto_coleta,
        cidadePontoColeta: ponto.lcr_pco_cidade_ponto_coleta,
        quantidade: 1,
        relato: dados.relato,
        dataRegistro: new Date((registro as any).dataRegistro).toISOString(),
        dataRevisao: '',
        pontosConcedidos: 0,
      } as RegistroDescarte;
    });
  }

  async listarMeus(idUsuario: string): Promise<RegistroDescarte[]> {
    if (!this.banco) return [];
    const linhas = await this.banco.query<Record<string, any>>(
      `SELECT r.lcr_rde_id_registro_descarte AS "idRegistro",
              r.lcr_rde_id_ponto_coleta AS "idPontoColeta",
              p.lcr_pco_nome_ponto_coleta AS "nomePontoColeta",
              p.lcr_pco_cidade_ponto_coleta AS "cidadePontoColeta",
              r.lcr_rde_categoria_material AS "categoriaMaterial",
              r.lcr_rde_quantidade AS quantidade,
              COALESCE(r.lcr_rde_relato, '') AS relato,
              r.lcr_rde_status AS status,
              r.lcr_rde_data_registro AS "dataRegistro",
              r.lcr_rde_data_revisao AS "dataRevisao",
              CASE WHEN r.lcr_rde_status = 'aprovado' THEN 20 ELSE 0 END AS "pontosConcedidos"
       FROM lcr_registros_descartes r
       JOIN lcr_pontos_coleta p ON p.lcr_pco_id_ponto_coleta = r.lcr_rde_id_ponto_coleta
       WHERE r.lcr_rde_id_usuario = :idUsuario
       ORDER BY r.lcr_rde_data_registro DESC
       LIMIT 100`,
      { replacements: { idUsuario }, type: QueryTypes.SELECT },
    );
    return linhas.map(mapearLinha);
  }

  async listarGestao(status: StatusRegistroDescarte | 'todos' = 'pendente'): Promise<RegistroDescarte[]> {
    if (!this.banco) return [];
    const linhas = await this.banco.query<Record<string, any>>(
      `SELECT r.lcr_rde_id_registro_descarte AS "idRegistro",
              r.lcr_rde_id_usuario AS "idUsuario",
              SUBSTRING(r.lcr_rde_id_usuario::text, 1, 8) AS "identificadorParticipante",
              r.lcr_rde_id_ponto_coleta AS "idPontoColeta",
              p.lcr_pco_nome_ponto_coleta AS "nomePontoColeta",
              p.lcr_pco_cidade_ponto_coleta AS "cidadePontoColeta",
              r.lcr_rde_categoria_material AS "categoriaMaterial",
              r.lcr_rde_quantidade AS quantidade,
              COALESCE(r.lcr_rde_relato, '') AS relato,
              r.lcr_rde_status AS status,
              r.lcr_rde_data_registro AS "dataRegistro",
              r.lcr_rde_data_revisao AS "dataRevisao",
              CASE WHEN r.lcr_rde_status = 'aprovado' THEN 20 ELSE 0 END AS "pontosConcedidos"
       FROM lcr_registros_descartes r
       JOIN lcr_pontos_coleta p ON p.lcr_pco_id_ponto_coleta = r.lcr_rde_id_ponto_coleta
       WHERE (:status = 'todos' OR r.lcr_rde_status = :status)
       ORDER BY CASE WHEN r.lcr_rde_status = 'pendente' THEN 0 ELSE 1 END,
                r.lcr_rde_data_registro ASC
       LIMIT 300`,
      { replacements: { status }, type: QueryTypes.SELECT },
    );
    return linhas.map(mapearLinha);
  }

  async revisar(
    dados: { idRegistro: string; idRevisor: string; status: 'aprovado' | 'rejeitado' },
    aoAprovar: (registro: RegistroDescarte, transaction: Transaction) => Promise<unknown>,
  ): Promise<RegistroDescarte | null> {
    if (!this.banco) return null;
    return this.banco.transaction(async transaction => {
      const linhas = await this.banco!.query<Record<string, any>>(
        `SELECT r.lcr_rde_id_registro_descarte AS "idRegistro",
                r.lcr_rde_id_usuario AS "idUsuario",
                SUBSTRING(r.lcr_rde_id_usuario::text, 1, 8) AS "identificadorParticipante",
                r.lcr_rde_id_ponto_coleta AS "idPontoColeta",
                p.lcr_pco_nome_ponto_coleta AS "nomePontoColeta",
                p.lcr_pco_cidade_ponto_coleta AS "cidadePontoColeta",
                r.lcr_rde_categoria_material AS "categoriaMaterial",
                r.lcr_rde_quantidade AS quantidade,
                COALESCE(r.lcr_rde_relato, '') AS relato,
                r.lcr_rde_status AS status,
                r.lcr_rde_data_registro AS "dataRegistro",
                r.lcr_rde_data_revisao AS "dataRevisao"
         FROM lcr_registros_descartes r
         JOIN lcr_pontos_coleta p ON p.lcr_pco_id_ponto_coleta = r.lcr_rde_id_ponto_coleta
         WHERE r.lcr_rde_id_registro_descarte = :idRegistro
         FOR UPDATE OF r`,
        { replacements: { idRegistro: dados.idRegistro }, type: QueryTypes.SELECT, transaction },
      );
      const linha = linhas[0];
      if (!linha || linha.status !== 'pendente' || linha.idUsuario === dados.idRevisor) return null;
      if (dados.status === 'aprovado') {
        const ponto = await ModeloPontoColeta.findOne({
          where: { lcr_pco_id_ponto_coleta: linha.idPontoColeta, lcr_pco_status_verificacao: 'verificado' },
          transaction,
          lock: transaction.LOCK.SHARE,
        });
        if (!ponto || !aceitaCategoria(ponto.lcr_pco_categorias_aceitas, linha.categoriaMaterial)) return null;
      }
      await this.banco!.query(
        `UPDATE lcr_registros_descartes
         SET lcr_rde_status = :status, lcr_rde_id_revisor = :idRevisor,
             lcr_rde_data_revisao = CURRENT_TIMESTAMP
         WHERE lcr_rde_id_registro_descarte = :idRegistro`,
        { replacements: dados, transaction },
      );
      const registro = { ...mapearLinha(linha), status: dados.status, dataRevisao: new Date().toISOString(), pontosConcedidos: dados.status === 'aprovado' ? 20 : 0 };
      if (dados.status === 'aprovado') await aoAprovar(registro, transaction);
      return registro;
    });
  }
}

function aceitaCategoria(categorias: string[] | null | undefined, categoria: string) {
  const alvo = normalizar(categoria);
  return Boolean(alvo && categorias?.some(item => normalizar(item) === alvo));
}

function normalizar(texto: string | null | undefined) {
  return (texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

function mapearLinha(linha: Record<string, any>): RegistroDescarte {
  return {
    ...linha,
    quantidade: Number(linha.quantidade ?? 1),
    dataRegistro: linha.dataRegistro ? new Date(linha.dataRegistro).toISOString() : '',
    dataRevisao: linha.dataRevisao ? new Date(linha.dataRevisao).toISOString() : '',
    pontosConcedidos: Number(linha.pontosConcedidos ?? 0),
  } as RegistroDescarte;
}
