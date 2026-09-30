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
  evidenciaDisponivel: boolean;
  temCheckin: boolean;
  distanciaCheckinMetros: number;
  precisaoCheckinMetros: number;
}

export type ResultadoCheckin =
  | { operacaoAceita: true; idCheckin: string; distanciaMetros: number; precisaoMetros: number; dataExpiracao: string }
  | { operacaoAceita: false; motivo: 'ponto_indisponivel' | 'fora_raio'; distanciaMetros?: number };

export type EvidenciaDescartarInput = {
  categoria: string;
  relato: string;
  chaveFoto: string;
  hashFotoSha256: string;
  tamanhoFotoBytes: number;
};

const RAIO_CHECKIN_METROS = 5;

@Injectable()
export class RepositorioDescartes {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async iniciarCheckin(dados: {
    idUsuario: string;
    idPontoColeta: string;
    latitude: number;
    longitude: number;
    precisaoMetros: number;
  }): Promise<ResultadoCheckin | null> {
    if (!this.banco) return null;
    return this.banco.transaction(async transaction => {
      const ponto = await ModeloPontoColeta.findOne({
        where: { lcr_pco_id_ponto_coleta: dados.idPontoColeta, lcr_pco_status_verificacao: 'verificado' },
        transaction,
        lock: transaction.LOCK.SHARE,
      });
      const latitudeBruta = ponto?.lcr_pco_latitude_ponto_coleta;
      const longitudeBruta = ponto?.lcr_pco_longitude_ponto_coleta;
      const latitudePonto = Number(latitudeBruta);
      const longitudePonto = Number(longitudeBruta);
      if (!ponto || latitudeBruta === null || latitudeBruta === undefined || longitudeBruta === null || longitudeBruta === undefined
        || !coordenadasValidas(latitudePonto, longitudePonto)) {
        return { operacaoAceita: false, motivo: 'ponto_indisponivel' };
      }

      const distanciaMetros = calcularDistanciaMetros(dados.latitude, dados.longitude, latitudePonto, longitudePonto);
      if (distanciaMetros > RAIO_CHECKIN_METROS) {
        return { operacaoAceita: false, motivo: 'fora_raio', distanciaMetros };
      }

      const checkins = await this.banco!.query<Record<string, unknown>>(
        `INSERT INTO lcr_checkins_descartes
           (lcr_cde_id_usuario, lcr_cde_id_ponto_coleta,
            lcr_cde_latitude_usuario, lcr_cde_longitude_usuario,
            lcr_cde_precisao_metros, lcr_cde_distancia_metros, lcr_cde_expira_em)
         VALUES
           (:idUsuario, :idPontoColeta, :latitude, :longitude,
            :precisaoMetros, :distanciaMetros, CURRENT_TIMESTAMP + INTERVAL '30 minutes')
         RETURNING lcr_cde_id_checkin AS "idCheckin", lcr_cde_expira_em AS "dataExpiracao"`,
        {
          replacements: { ...dados, distanciaMetros },
          type: QueryTypes.SELECT,
          transaction,
        },
      );
      const checkin = checkins[0];
      if (!checkin) return null;
      return {
        operacaoAceita: true,
        idCheckin: String(checkin.idCheckin),
        distanciaMetros,
        precisaoMetros: dados.precisaoMetros,
        dataExpiracao: new Date(checkin.dataExpiracao as string | Date).toISOString(),
      };
    });
  }

  async concluir(dados: {
    idUsuario: string;
    idCheckin: string;
    itens: EvidenciaDescartarInput[];
  }): Promise<RegistroDescarte[] | null> {
    if (!this.banco) return null;
    return this.banco.transaction(async transaction => {
      await this.banco!.query('SELECT pg_advisory_xact_lock(hashtextextended(:idUsuario, 0))', {
        replacements: { idUsuario: dados.idUsuario }, transaction,
      });
      const checkins = await this.banco!.query<Record<string, any>>(
        `SELECT lcr_cde_id_checkin AS "idCheckin",
                lcr_cde_id_ponto_coleta AS "idPontoColeta",
                lcr_cde_latitude_usuario AS latitude,
                lcr_cde_longitude_usuario AS longitude,
                lcr_cde_distancia_metros AS "distanciaMetros",
                lcr_cde_precisao_metros AS "precisaoMetros"
         FROM lcr_checkins_descartes
         WHERE lcr_cde_id_checkin = :idCheckin
           AND lcr_cde_id_usuario = :idUsuario
           AND lcr_cde_status = 'ativo'
           AND lcr_cde_expira_em > CURRENT_TIMESTAMP
         FOR UPDATE`,
        { replacements: { idCheckin: dados.idCheckin, idUsuario: dados.idUsuario }, type: QueryTypes.SELECT, transaction },
      );
      const checkin = checkins[0];
      if (!checkin) return null;

      const ponto = await ModeloPontoColeta.findOne({
        where: { lcr_pco_id_ponto_coleta: checkin.idPontoColeta, lcr_pco_status_verificacao: 'verificado' },
        transaction,
        lock: transaction.LOCK.SHARE,
      });
      const latitudeBruta = ponto?.lcr_pco_latitude_ponto_coleta;
      const longitudeBruta = ponto?.lcr_pco_longitude_ponto_coleta;
      const latitudePonto = Number(latitudeBruta);
      const longitudePonto = Number(longitudeBruta);
      if (!ponto || latitudeBruta === null || latitudeBruta === undefined || longitudeBruta === null || longitudeBruta === undefined
        || !coordenadasValidas(latitudePonto, longitudePonto)
        || calcularDistanciaMetros(Number(checkin.latitude), Number(checkin.longitude), latitudePonto, longitudePonto) > RAIO_CHECKIN_METROS
        || dados.itens.some(item => !aceitaCategoria(ponto.lcr_pco_categorias_aceitas, item.categoria))) {
        return null;
      }

      const existentes = await this.banco!.query<{ quantidade: number; repetido: boolean }>(
        `SELECT COUNT(*)::integer AS quantidade,
                COALESCE(BOOL_OR(
                  lcr_rde_id_ponto_coleta = :idPontoColeta
                  AND LOWER(lcr_rde_categoria_material) IN (:categorias)
                ), false) AS repetido
         FROM lcr_registros_descartes
         WHERE lcr_rde_id_usuario = :idUsuario
           AND lcr_rde_data_registro >= CURRENT_TIMESTAMP - INTERVAL '24 hours'`,
        {
          replacements: {
            idUsuario: dados.idUsuario,
            idPontoColeta: checkin.idPontoColeta,
            categorias: dados.itens.map(item => item.categoria.toLocaleLowerCase('pt-BR')),
          },
          type: QueryTypes.SELECT,
          transaction,
        },
      );
      const quantidadeAtual = Number(existentes[0]?.quantidade ?? 0);
      if (quantidadeAtual + dados.itens.length > 10 || Boolean(existentes[0]?.repetido)) return null;

      const resultados: RegistroDescarte[] = [];
      for (const item of dados.itens) {
        const linhas = await this.banco!.query<Record<string, any>>(
          `INSERT INTO lcr_registros_descartes
             (lcr_rde_id_usuario, lcr_rde_id_ponto_coleta, lcr_rde_categoria_material,
              lcr_rde_relato, lcr_rde_id_checkin, lcr_rde_chave_foto,
              lcr_rde_hash_foto_sha256, lcr_rde_tamanho_foto_bytes)
           VALUES
             (:idUsuario, :idPontoColeta, :categoria, :relato, :idCheckin,
              :chaveFoto, :hashFotoSha256, :tamanhoFotoBytes)
           RETURNING lcr_rde_id_registro_descarte AS "idRegistro",
                     lcr_rde_categoria_material AS "categoriaMaterial",
                     lcr_rde_status AS status,
                     lcr_rde_data_registro AS "dataRegistro"`,
          {
            replacements: {
              idUsuario: dados.idUsuario,
              idPontoColeta: checkin.idPontoColeta,
              idCheckin: dados.idCheckin,
              categoria: item.categoria,
              relato: item.relato || null,
              chaveFoto: item.chaveFoto,
              hashFotoSha256: item.hashFotoSha256,
              tamanhoFotoBytes: item.tamanhoFotoBytes,
            },
            type: QueryTypes.SELECT,
            transaction,
          },
        );
        if (!linhas[0]) return null;
        resultados.push({
          idRegistro: String(linhas[0].idRegistro),
          idUsuario: dados.idUsuario,
          idPontoColeta: String(checkin.idPontoColeta),
          nomePontoColeta: ponto.lcr_pco_nome_ponto_coleta,
          cidadePontoColeta: ponto.lcr_pco_cidade_ponto_coleta,
          categoriaMaterial: String(linhas[0].categoriaMaterial),
          quantidade: 1,
          relato: item.relato,
          status: 'pendente',
          dataRegistro: new Date(linhas[0].dataRegistro).toISOString(),
          dataRevisao: '',
          pontosConcedidos: 0,
          evidenciaDisponivel: true,
          temCheckin: true,
          distanciaCheckinMetros: Number(checkin.distanciaMetros),
          precisaoCheckinMetros: Number(checkin.precisaoMetros),
        });
      }

      await this.banco!.query(
        `UPDATE lcr_checkins_descartes
         SET lcr_cde_status = 'finalizado', lcr_cde_data_finalizacao = CURRENT_TIMESTAMP
         WHERE lcr_cde_id_checkin = :idCheckin`,
        { replacements: { idCheckin: dados.idCheckin }, transaction },
      );
      return resultados;
    });
  }

  async listarMeus(idUsuario: string): Promise<RegistroDescarte[]> {
    if (!this.banco) return [];
    const linhas = await this.banco.query<Record<string, any>>(
      `SELECT r.lcr_rde_id_registro_descarte AS "idRegistro",
              r.lcr_rde_id_usuario AS "idUsuario",
              r.lcr_rde_id_ponto_coleta AS "idPontoColeta",
              p.lcr_pco_nome_ponto_coleta AS "nomePontoColeta",
              p.lcr_pco_cidade_ponto_coleta AS "cidadePontoColeta",
              r.lcr_rde_categoria_material AS "categoriaMaterial",
              r.lcr_rde_quantidade AS quantidade,
              COALESCE(r.lcr_rde_relato, '') AS relato,
              r.lcr_rde_status AS status,
              r.lcr_rde_data_registro AS "dataRegistro",
              r.lcr_rde_data_revisao AS "dataRevisao",
              (r.lcr_rde_chave_foto IS NOT NULL AND r.lcr_rde_foto_removida_em IS NULL
                AND (r.lcr_rde_foto_expira_em IS NULL OR r.lcr_rde_foto_expira_em > CURRENT_TIMESTAMP)) AS "evidenciaDisponivel",
              (c.lcr_cde_id_checkin IS NOT NULL) AS "temCheckin",
              COALESCE(c.lcr_cde_distancia_metros, 0) AS "distanciaCheckinMetros",
              COALESCE(c.lcr_cde_precisao_metros, 0) AS "precisaoCheckinMetros",
              CASE WHEN r.lcr_rde_status = 'aprovado' THEN 20 ELSE 0 END AS "pontosConcedidos"
       FROM lcr_registros_descartes r
       JOIN lcr_pontos_coleta p ON p.lcr_pco_id_ponto_coleta = r.lcr_rde_id_ponto_coleta
       LEFT JOIN lcr_checkins_descartes c ON c.lcr_cde_id_checkin = r.lcr_rde_id_checkin
       WHERE r.lcr_rde_id_usuario = :idUsuario
       ORDER BY r.lcr_rde_data_registro DESC
       LIMIT 500`,
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
              (r.lcr_rde_chave_foto IS NOT NULL AND r.lcr_rde_foto_removida_em IS NULL
                AND (r.lcr_rde_foto_expira_em IS NULL OR r.lcr_rde_foto_expira_em > CURRENT_TIMESTAMP)) AS "evidenciaDisponivel",
              (c.lcr_cde_id_checkin IS NOT NULL) AS "temCheckin",
              COALESCE(c.lcr_cde_distancia_metros, 0) AS "distanciaCheckinMetros",
              COALESCE(c.lcr_cde_precisao_metros, 0) AS "precisaoCheckinMetros",
              CASE WHEN r.lcr_rde_status = 'aprovado' THEN 20 ELSE 0 END AS "pontosConcedidos"
       FROM lcr_registros_descartes r
       JOIN lcr_pontos_coleta p ON p.lcr_pco_id_ponto_coleta = r.lcr_rde_id_ponto_coleta
       LEFT JOIN lcr_checkins_descartes c ON c.lcr_cde_id_checkin = r.lcr_rde_id_checkin
       WHERE (:status = 'todos' OR r.lcr_rde_status = :status)
       ORDER BY CASE WHEN r.lcr_rde_status = 'pendente' THEN 0 ELSE 1 END,
                r.lcr_rde_data_registro ASC
       LIMIT 300`,
      { replacements: { status }, type: QueryTypes.SELECT },
    );
    return linhas.map(mapearLinha);
  }

  async obterChaveEvidencia(idRegistro: string, idUsuario: string, podeRevisar: boolean): Promise<string | null> {
    if (!this.banco || !UUID.test(idRegistro)) return null;
    const linhas = await this.banco.query<{ idUsuario: string; chave: string | null; removidaEm: Date | null }>(
      `SELECT lcr_rde_id_usuario AS "idUsuario",
              lcr_rde_chave_foto AS chave,
              lcr_rde_foto_removida_em AS "removidaEm"
       FROM lcr_registros_descartes
       WHERE lcr_rde_id_registro_descarte = :idRegistro
         AND (lcr_rde_foto_expira_em IS NULL OR lcr_rde_foto_expira_em > CURRENT_TIMESTAMP)`,
      { replacements: { idRegistro }, type: QueryTypes.SELECT },
    );
    const linha = linhas[0];
    if (!linha || (!podeRevisar && linha.idUsuario !== idUsuario) || !linha.chave || linha.removidaEm) return null;
    return linha.chave;
  }

  async revisar(
    dados: { idRegistro: string; idRevisor: string; status: 'aprovado' | 'rejeitado' },
    aoAprovar: (registro: RegistroDescarte, transaction: Transaction) => Promise<unknown>,
  ): Promise<RegistroDescarte | null> {
    if (!this.banco || !UUID.test(dados.idRegistro)) return null;
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
                r.lcr_rde_data_revisao AS "dataRevisao",
                r.lcr_rde_id_checkin AS "idCheckin",
                r.lcr_rde_chave_foto AS "chaveFoto",
                (r.lcr_rde_chave_foto IS NOT NULL AND r.lcr_rde_foto_removida_em IS NULL
                AND (r.lcr_rde_foto_expira_em IS NULL OR r.lcr_rde_foto_expira_em > CURRENT_TIMESTAMP)) AS "evidenciaDisponivel",
                (c.lcr_cde_id_checkin IS NOT NULL) AS "temCheckin",
                COALESCE(c.lcr_cde_distancia_metros, 0) AS "distanciaCheckinMetros",
                COALESCE(c.lcr_cde_precisao_metros, 0) AS "precisaoCheckinMetros"
         FROM lcr_registros_descartes r
         JOIN lcr_pontos_coleta p ON p.lcr_pco_id_ponto_coleta = r.lcr_rde_id_ponto_coleta
         LEFT JOIN lcr_checkins_descartes c ON c.lcr_cde_id_checkin = r.lcr_rde_id_checkin
         WHERE r.lcr_rde_id_registro_descarte = :idRegistro
         FOR UPDATE OF r`,
        { replacements: { idRegistro: dados.idRegistro }, type: QueryTypes.SELECT, transaction },
      );
      const linha = linhas[0];
      if (!linha || linha.status !== 'pendente' || linha.idUsuario === dados.idRevisor) return null;
      if (dados.status === 'aprovado' && (!linha.idCheckin || !linha.chaveFoto || !linha.evidenciaDisponivel)) return null;
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
             lcr_rde_data_revisao = CURRENT_TIMESTAMP,
             lcr_rde_foto_expira_em = CASE
               WHEN lcr_rde_chave_foto IS NOT NULL
                 AND lcr_rde_foto_removida_em IS NULL
                 AND (lcr_rde_foto_expira_em IS NULL OR lcr_rde_foto_expira_em > CURRENT_TIMESTAMP)
               THEN CURRENT_TIMESTAMP + INTERVAL '90 days'
               ELSE lcr_rde_foto_expira_em
             END
         WHERE lcr_rde_id_registro_descarte = :idRegistro`,
        { replacements: dados, transaction },
      );
      if (linha.idCheckin) {
        await this.banco!.query(
          `UPDATE lcr_checkins_descartes c
           SET lcr_cde_dados_expiram_em = CURRENT_TIMESTAMP + INTERVAL '90 days'
           WHERE c.lcr_cde_id_checkin = :idCheckin
             AND NOT EXISTS (
               SELECT 1 FROM lcr_registros_descartes pendente
               WHERE pendente.lcr_rde_id_checkin = c.lcr_cde_id_checkin
                 AND pendente.lcr_rde_status = 'pendente'
                 AND pendente.lcr_rde_id_registro_descarte <> :idRegistro
             )`,
          { replacements: { idCheckin: linha.idCheckin, idRegistro: dados.idRegistro }, transaction },
        );
      }
      const registro = {
        ...mapearLinha(linha),
        status: dados.status,
        dataRevisao: new Date().toISOString(),
        pontosConcedidos: dados.status === 'aprovado' ? 20 : 0,
      };
      if (dados.status === 'aprovado') await aoAprovar(registro, transaction);
      return registro;
    });
  }

  async expurgarEvidencias(removerImagem: (chave: string) => Promise<void>): Promise<{ fotos: number; coordenadas: number; checkinsAbandonados: number }> {
    if (!this.banco) return { fotos: 0, coordenadas: 0, checkinsAbandonados: 0 };
    return this.banco.transaction(async transaction => {
      const fotos = await this.banco!.query<{ idRegistro: string; chave: string }>(
        `SELECT lcr_rde_id_registro_descarte AS "idRegistro", lcr_rde_chave_foto AS chave
         FROM lcr_registros_descartes
         WHERE lcr_rde_chave_foto IS NOT NULL
           AND lcr_rde_foto_expira_em <= CURRENT_TIMESTAMP
         ORDER BY lcr_rde_foto_expira_em
         LIMIT 500
         FOR UPDATE SKIP LOCKED`,
        { type: QueryTypes.SELECT, transaction },
      );
      for (const foto of fotos) {
        await removerImagem(foto.chave);
        await this.banco!.query(
          `UPDATE lcr_registros_descartes
           SET lcr_rde_chave_foto = NULL, lcr_rde_foto_removida_em = CURRENT_TIMESTAMP
           WHERE lcr_rde_id_registro_descarte = :idRegistro`,
          { replacements: { idRegistro: foto.idRegistro }, transaction },
        );
      }

      const checkins = await this.banco!.query<{ idCheckin: string }>(
        `SELECT c.lcr_cde_id_checkin AS "idCheckin"
         FROM lcr_checkins_descartes c
         WHERE c.lcr_cde_dados_expiram_em <= CURRENT_TIMESTAMP
           AND c.lcr_cde_latitude_usuario IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM lcr_registros_descartes r
             WHERE r.lcr_rde_id_checkin = c.lcr_cde_id_checkin AND r.lcr_rde_status = 'pendente'
           )
         ORDER BY c.lcr_cde_dados_expiram_em
         LIMIT 500
         FOR UPDATE SKIP LOCKED`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (checkins.length) {
        await this.banco!.query(
          `UPDATE lcr_checkins_descartes
           SET lcr_cde_latitude_usuario = NULL, lcr_cde_longitude_usuario = NULL
           WHERE lcr_cde_id_checkin IN (:ids)`,
          { replacements: { ids: checkins.map(item => item.idCheckin) }, transaction },
        );
      }

      const abandonados = await this.banco!.query<{ idCheckin: string }>(
        `DELETE FROM lcr_checkins_descartes c
         WHERE c.lcr_cde_status = 'ativo' AND c.lcr_cde_expira_em <= CURRENT_TIMESTAMP
           AND NOT EXISTS (
             SELECT 1 FROM lcr_registros_descartes r WHERE r.lcr_rde_id_checkin = c.lcr_cde_id_checkin
           )
         RETURNING c.lcr_cde_id_checkin AS "idCheckin"`,
        { type: QueryTypes.SELECT, transaction },
      );
      return { fotos: fotos.length, coordenadas: checkins.length, checkinsAbandonados: abandonados.length };
    });
  }
}

export function calcularDistanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radianos = (graus: number) => (graus * Math.PI) / 180;
  const deltaLatitude = radianos(lat2 - lat1);
  const deltaLongitude = radianos(lon2 - lon1);
  const origemLatitude = radianos(lat1);
  const destinoLatitude = radianos(lat2);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(origemLatitude) * Math.cos(destinoLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function coordenadasValidas(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
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
    evidenciaDisponivel: Boolean(linha.evidenciaDisponivel),
    temCheckin: Boolean(linha.temCheckin),
    distanciaCheckinMetros: Number(linha.distanciaCheckinMetros ?? 0),
    precisaoCheckinMetros: Number(linha.precisaoCheckinMetros ?? 0),
  } as RegistroDescarte;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
