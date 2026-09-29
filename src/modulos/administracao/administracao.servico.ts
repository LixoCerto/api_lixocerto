import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Op, QueryTypes, Sequelize, Transaction } from 'sequelize';
import { ModeloPapel } from '../../infraestrutura/banco/modelos/papel.modelo.js';
import { ModeloPermissao } from '../../infraestrutura/banco/modelos/permissao.modelo.js';
import { ModeloSessao } from '../../infraestrutura/banco/modelos/sessao.modelo.js';
import { ModeloUsuario } from '../../infraestrutura/banco/modelos/usuario.modelo.js';
import { ServicoAuditoria } from '../auditoria/auditoria.servico.js';

const PAPEIS_SISTEMA_PROTEGIDOS = new Set(['usuario', 'pesquisador', 'revisor', 'administrador']);
const CODIGO_GERIR_ACESSOS = 'administracao:gerenciar_acessos';
const LIMITE_PAGINA_MAXIMO = 100;

export interface ResumoAdministrativo {
  quantidadeUsuarios: number;
  quantidadeMateriais: number;
  quantidadePapeis: number;
  quantidadeAuditorias: number;
  quantidadeMateriaisPublicados: number;
  quantidadePontosPendentes: number;
  quantidadeAvaliacoes: number;
}

export interface FiltroUsuariosAdministrativos {
  busca?: string;
  status?: string;
  deslocamento?: number;
  limite?: number;
}

export interface UsuarioAdministrativo {
  idUsuario: string;
  nomeUsuario: string;
  emailUsuario: string;
  statusUsuario: string;
  emailVerificado: boolean;
  dataCriacao: string;
  dataUltimoAcesso: string;
  papeis: { idPapel: string; nomePapel: string; statusPapel: string }[];
}

export interface PapelAdministrativo {
  idPapel: string;
  nomePapel: string;
  descricaoPapel: string;
  statusPapel: string;
  papelSistema: boolean;
  quantidadeUsuarios: number;
  idsPermissoes: string[];
  codigosPermissoes: string[];
}

export interface PermissaoAdministrativa {
  idPermissao: string;
  codigoPermissao: string;
  nomePermissao: string;
  descricaoPermissao: string;
  statusPermissao: string;
}

@Injectable()
export class ServicoAdministracao {
  constructor(
    @Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null,
    private readonly auditoria: ServicoAuditoria,
  ) {}

  async obterResumo(): Promise<ResumoAdministrativo> {
    if (!this.banco) {
      return {
        quantidadeUsuarios: 0,
        quantidadeMateriais: 0,
        quantidadePapeis: 0,
        quantidadeAuditorias: 0,
        quantidadeMateriaisPublicados: 0,
        quantidadePontosPendentes: 0,
        quantidadeAvaliacoes: 0,
      };
    }
    const [usuarios, papeis, auditorias, materiais, totalMateriais, pontos, avaliacoes] = await Promise.all([
      this.contar("SELECT COUNT(*)::int AS quantidade FROM lcr_usuarios WHERE lcr_usr_status_usuario = 'ativo'"),
      this.contar("SELECT COUNT(*)::int AS quantidade FROM lcr_papeis WHERE lcr_pap_status_papel = 'ativo'"),
      this.contar('SELECT COUNT(*)::int AS quantidade FROM lcr_registros_auditoria'),
      this.contar("SELECT COUNT(*)::int AS quantidade FROM lcr_materiais WHERE lcr_mat_status_material = 'publicado'"),
      this.contar('SELECT COUNT(*)::int AS quantidade FROM lcr_materiais'),
      this.contar("SELECT COUNT(*)::int AS quantidade FROM lcr_pontos_coleta WHERE lcr_pco_status_verificacao = 'pendente'"),
      this.contar('SELECT COUNT(*)::int AS quantidade FROM lcr_sessoes_avaliacao WHERE lcr_sea_indica_consentimento = TRUE'),
    ]);
    return {
      quantidadeUsuarios: usuarios,
      quantidadeMateriais: totalMateriais,
      quantidadePapeis: papeis,
      quantidadeAuditorias: auditorias,
      quantidadeMateriaisPublicados: materiais,
      quantidadePontosPendentes: pontos,
      quantidadeAvaliacoes: avaliacoes,
    };
  }

  async listarUsuarios(filtro: FiltroUsuariosAdministrativos = {}): Promise<{ usuarios: UsuarioAdministrativo[]; total: number }> {
    const banco = this.exigirBanco();
    const deslocamento = Math.max(0, Math.floor(filtro.deslocamento ?? 0));
    const limite = this.limitar(filtro.limite, 25);
    const status = this.validarStatusUsuarioFiltro(filtro.status);
    const busca = filtro.busca?.trim() ?? '';
    const where = `WHERE (:status = '' OR u.lcr_usr_status_usuario = :status)
      AND (:busca = '' OR u.lcr_usr_nome ILIKE :padrao OR u.lcr_usr_email ILIKE :padrao)`;
    const replacements = { status, busca, padrao: `%${busca}%`, limite, deslocamento };
    const [usuarios, totais] = await Promise.all([
      banco.query<Record<string, unknown>>(
        `SELECT u.lcr_usr_id_usuario, u.lcr_usr_nome, u.lcr_usr_email,
          u.lcr_usr_status_usuario, u.lcr_usr_email_verificado_em,
          u.lcr_usr_data_criacao, u.lcr_usr_data_ultimo_acesso,
          COALESCE(json_agg(DISTINCT jsonb_build_object(
            'idPapel', p.lcr_pap_id_papel,
            'nomePapel', p.lcr_pap_nome_papel,
            'statusPapel', p.lcr_pap_status_papel
          )) FILTER (WHERE p.lcr_pap_id_papel IS NOT NULL), '[]'::json) AS papeis
        FROM lcr_usuarios u
        LEFT JOIN lcr_usuarios_papeis up ON up.lcr_upr_id_usuario = u.lcr_usr_id_usuario
        LEFT JOIN lcr_papeis p ON p.lcr_pap_id_papel = up.lcr_upr_id_papel
        ${where}
        GROUP BY u.lcr_usr_id_usuario
        ORDER BY u.lcr_usr_data_criacao DESC, u.lcr_usr_id_usuario
        LIMIT :limite OFFSET :deslocamento`,
        { replacements, type: QueryTypes.SELECT },
      ),
      banco.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM lcr_usuarios u ${where}`,
        { replacements: { status, busca, padrao: `%${busca}%` }, type: QueryTypes.SELECT },
      ),
    ]);
    return {
      usuarios: usuarios.map((item) => ({
        idUsuario: String(item.lcr_usr_id_usuario),
        nomeUsuario: String(item.lcr_usr_nome),
        emailUsuario: String(item.lcr_usr_email),
        statusUsuario: String(item.lcr_usr_status_usuario),
        emailVerificado: item.lcr_usr_email_verificado_em !== null,
        dataCriacao: this.iso(item.lcr_usr_data_criacao),
        dataUltimoAcesso: item.lcr_usr_data_ultimo_acesso ? this.iso(item.lcr_usr_data_ultimo_acesso) : '',
        papeis: this.jsonArray(item.papeis).map((papel) => ({
          idPapel: String(papel.idPapel),
          nomePapel: String(papel.nomePapel),
          statusPapel: String(papel.statusPapel),
        })),
      })),
      total: Number(totais[0]?.total ?? 0),
    };
  }

  async listarPapeis(incluirInativos = false): Promise<PapelAdministrativo[]> {
    const banco = this.exigirBanco();
    const [papeis, permissoes] = await Promise.all([
      banco.query<Record<string, unknown>>(
        `SELECT p.lcr_pap_id_papel, p.lcr_pap_nome_papel, p.lcr_pap_descricao_papel,
          p.lcr_pap_status_papel,
          COUNT(DISTINCT up.lcr_upr_id_usuario)::int AS quantidade_usuarios,
          COALESCE(array_agg(DISTINCT prm.lcr_prm_id_permissao)
            FILTER (WHERE prm.lcr_prm_id_permissao IS NOT NULL), ARRAY[]::uuid[]) AS ids_permissoes,
          COALESCE(array_agg(DISTINCT prm.lcr_prm_codigo_permissao)
            FILTER (WHERE prm.lcr_prm_id_permissao IS NOT NULL), ARRAY[]::text[]) AS codigos_permissoes
        FROM lcr_papeis p
        LEFT JOIN lcr_usuarios_papeis up ON up.lcr_upr_id_papel = p.lcr_pap_id_papel
        LEFT JOIN lcr_papeis_permissoes pp ON pp.lcr_ppm_id_papel = p.lcr_pap_id_papel
        LEFT JOIN lcr_permissoes prm ON prm.lcr_prm_id_permissao = pp.lcr_ppm_id_permissao
          AND prm.lcr_prm_status_permissao = 'ativo'
        WHERE (:incluirInativos = TRUE OR p.lcr_pap_status_papel = 'ativo')
        GROUP BY p.lcr_pap_id_papel
        ORDER BY CASE WHEN p.lcr_pap_nome_papel = 'administrador' THEN 0 ELSE 1 END,
          p.lcr_pap_nome_papel`,
        { replacements: { incluirInativos }, type: QueryTypes.SELECT },
      ),
      this.listarPermissoes(),
    ]);
    const todasIds = permissoes.filter((p) => p.statusPermissao === 'ativo').map((p) => p.idPermissao);
    const todosCodigos = permissoes.filter((p) => p.statusPermissao === 'ativo').map((p) => p.codigoPermissao);
    return papeis.map((item) => {
      const nome = String(item.lcr_pap_nome_papel);
      const protegido = nome === 'administrador';
      return {
        idPapel: String(item.lcr_pap_id_papel),
        nomePapel: nome,
        descricaoPapel: String(item.lcr_pap_descricao_papel),
        statusPapel: String(item.lcr_pap_status_papel),
        papelSistema: PAPEIS_SISTEMA_PROTEGIDOS.has(nome),
        quantidadeUsuarios: Number(item.quantidade_usuarios ?? 0),
        idsPermissoes: protegido ? todasIds : this.stringArray(item.ids_permissoes),
        codigosPermissoes: protegido ? todosCodigos : this.stringArray(item.codigos_permissoes),
      };
    });
  }

  async listarPermissoes(): Promise<PermissaoAdministrativa[]> {
    if (!this.banco) return [];
    const permissoes = await ModeloPermissao.findAll({
      order: [['lcr_prm_codigo_permissao', 'ASC']],
    });
    return permissoes.map((item) => ({
      idPermissao: item.lcr_prm_id_permissao,
      codigoPermissao: item.lcr_prm_codigo_permissao,
      nomePermissao: item.lcr_prm_nome_permissao,
      descricaoPermissao: item.lcr_prm_descricao_permissao,
      statusPermissao: item.lcr_prm_status_permissao,
    }));
  }

  async criarPapel(dados: { nome: string; descricao: string; idsPermissoes: string[]; motivo: string }, ator: string, correlacao: string): Promise<string> {
    const banco = this.exigirBanco();
    const nome = this.validarNomePapel(dados.nome);
    const descricao = this.validarDescricao(dados.descricao);
    const ids = this.validarListaIds(dados.idsPermissoes);
    const motivo = this.validarMotivo(dados.motivo);
    this.rejeitarPapelSistema(nome);
    const transaction = await banco.transaction();
    try {
      if (await ModeloPapel.findOne({ where: { lcr_pap_nome_papel: nome }, transaction })) {
        throw new ConflictException('Já existe um papel com esse identificador.');
      }
      await this.validarPermissoes(ids, transaction);
      await this.rejeitarPermissaoExclusiva(ids, transaction);
      const papel = await ModeloPapel.create({
        lcr_pap_nome_papel: nome,
        lcr_pap_descricao_papel: descricao,
        lcr_pap_status_papel: 'ativo',
      }, { transaction });
      await this.substituirPermissoesPapel(papel.lcr_pap_id_papel, ids, transaction);
      await this.registrarAuditoria(transaction, ator, correlacao, 'administracao.papel.criado', 'papel', papel.lcr_pap_id_papel, {
        nomePapel: nome,
        quantidadePermissoes: ids.length,
        motivo,
      });
      await transaction.commit();
      return papel.lcr_pap_id_papel;
    } catch (erro) {
      await transaction.rollback();
      throw erro;
    }
  }

  async atualizarPapel(idPapel: string, dados: { nome: string; descricao: string; idsPermissoes?: string[]; motivo?: string }, ator: string, correlacao: string) {
    const banco = this.exigirBanco();
    const nome = this.validarNomePapel(dados.nome);
    const descricao = this.validarDescricao(dados.descricao);
    const ids = dados.idsPermissoes === undefined ? undefined : this.validarListaIds(dados.idsPermissoes);
    const motivo = ids === undefined ? undefined : this.validarMotivo(dados.motivo ?? '');
    this.rejeitarPapelSistema(nome);
    const transaction = await banco.transaction();
    try {
      const papel = await ModeloPapel.findByPk(idPapel, { transaction, lock: transaction.LOCK.UPDATE });
      if (!papel) throw new NotFoundException('Papel não encontrado.');
      this.rejeitarPapelSistema(papel.lcr_pap_nome_papel);
      if (await ModeloPapel.findOne({ where: { lcr_pap_nome_papel: nome, lcr_pap_id_papel: { [Op.ne]: idPapel } }, transaction, lock: transaction.LOCK.UPDATE })) {
        throw new ConflictException('Já existe um papel com esse identificador.');
      }
      const antes = { nomePapel: papel.lcr_pap_nome_papel, descricaoPapel: papel.lcr_pap_descricao_papel };
      let permissoesAnteriores: string[] = [];
      let sessoesRevogadas = 0;
      if (ids !== undefined) {
        await this.validarPermissoes(ids, transaction);
        await this.rejeitarPermissaoExclusiva(ids, transaction);
        const anteriores = await banco.query<{ lcr_prm_codigo_permissao: string }>(
          `SELECT prm.lcr_prm_codigo_permissao FROM lcr_papeis_permissoes pp
           INNER JOIN lcr_permissoes prm ON prm.lcr_prm_id_permissao = pp.lcr_ppm_id_permissao
           WHERE pp.lcr_ppm_id_papel = :idPapel ORDER BY prm.lcr_prm_codigo_permissao`,
          { replacements: { idPapel }, type: QueryTypes.SELECT, transaction },
        );
        permissoesAnteriores = anteriores.map((item) => item.lcr_prm_codigo_permissao);
        await this.substituirPermissoesPapel(idPapel, ids, transaction);
        const sessoes = await banco.query<{ lcr_ses_id_sessao: string }>(
          `UPDATE lcr_sessoes SET lcr_ses_data_revogacao = CURRENT_TIMESTAMP
           WHERE lcr_ses_data_revogacao IS NULL AND lcr_ses_id_usuario IN
             (SELECT lcr_upr_id_usuario FROM lcr_usuarios_papeis WHERE lcr_upr_id_papel = :idPapel)
           RETURNING lcr_ses_id_sessao`,
          { replacements: { idPapel }, type: QueryTypes.SELECT, transaction },
        );
        sessoesRevogadas = sessoes.length;
      }
      await papel.update({ lcr_pap_nome_papel: nome, lcr_pap_descricao_papel: descricao, lcr_pap_data_atualizacao: new Date() }, { transaction });
      await this.registrarAuditoria(transaction, ator, correlacao, 'administracao.papel.atualizado', 'papel', idPapel, {
        antes,
        depois: { nomePapel: nome, descricaoPapel: descricao },
        ...(ids === undefined ? {} : { permissoesAnteriores, idsPermissoesNovas: ids, motivo, sessoesRevogadas }),
      });
      await transaction.commit();
    } catch (erro) {
      await transaction.rollback();
      throw erro;
    }
  }

  async arquivarPapel(idPapel: string, motivo: string, ator: string, correlacao: string) {
    const banco = this.exigirBanco();
    const motivoNormalizado = this.validarMotivo(motivo);
    const transaction = await banco.transaction();
    try {
      const papel = await ModeloPapel.findByPk(idPapel, { transaction, lock: transaction.LOCK.UPDATE });
      if (!papel) throw new NotFoundException('Papel não encontrado.');
      this.rejeitarPapelSistema(papel.lcr_pap_nome_papel);
      const [uso] = await banco.query<{ quantidade: number }>(
        'SELECT COUNT(*)::int AS quantidade FROM lcr_usuarios_papeis WHERE lcr_upr_id_papel = :idPapel',
        { replacements: { idPapel }, type: QueryTypes.SELECT, transaction },
      );
      if (Number(uso?.quantidade ?? 0) > 0) throw new ConflictException('Reatribua os usuários antes de arquivar este papel.');
      await papel.update({ lcr_pap_status_papel: 'inativo', lcr_pap_data_atualizacao: new Date() }, { transaction });
      await this.registrarAuditoria(transaction, ator, correlacao, 'administracao.papel.arquivado', 'papel', idPapel, { nomePapel: papel.lcr_pap_nome_papel, motivo: motivoNormalizado });
      await transaction.commit();
    } catch (erro) {
      await transaction.rollback();
      throw erro;
    }
  }

  async restaurarPapel(idPapel: string, motivo: string, ator: string, correlacao: string) {
    const banco = this.exigirBanco();
    const motivoNormalizado = this.validarMotivo(motivo);
    const transaction = await banco.transaction();
    try {
      const papel = await ModeloPapel.findByPk(idPapel, { transaction, lock: transaction.LOCK.UPDATE });
      if (!papel) throw new NotFoundException('Papel não encontrado.');
      if (papel.lcr_pap_status_papel === 'ativo') {
        await transaction.commit();
        return;
      }
      await papel.update({ lcr_pap_status_papel: 'ativo', lcr_pap_data_atualizacao: new Date() }, { transaction });
      await this.registrarAuditoria(transaction, ator, correlacao, 'administracao.papel.restaurado', 'papel', idPapel, { nomePapel: papel.lcr_pap_nome_papel, motivo: motivoNormalizado });
      await transaction.commit();
    } catch (erro) {
      await transaction.rollback();
      throw erro;
    }
  }

  async definirPermissoesPapel(idPapel: string, idsPermissoes: string[], motivo: string, ator: string, correlacao: string) {
    const banco = this.exigirBanco();
    const ids = this.validarListaIds(idsPermissoes);
    const motivoNormalizado = this.validarMotivo(motivo);
    const transaction = await banco.transaction();
    try {
      const papel = await ModeloPapel.findByPk(idPapel, { transaction, lock: transaction.LOCK.UPDATE });
      if (!papel) throw new NotFoundException('Papel não encontrado.');
      if (papel.lcr_pap_nome_papel === 'administrador') {
        throw new ForbiddenException('As permissões do papel administrador são protegidas pelo sistema.');
      }
      await this.validarPermissoes(ids, transaction);
      await this.rejeitarPermissaoExclusiva(ids, transaction);
      const anteriores = await banco.query<{ lcr_prm_codigo_permissao: string }>(
        `SELECT prm.lcr_prm_codigo_permissao FROM lcr_papeis_permissoes pp
         INNER JOIN lcr_permissoes prm ON prm.lcr_prm_id_permissao = pp.lcr_ppm_id_permissao
         WHERE pp.lcr_ppm_id_papel = :idPapel ORDER BY prm.lcr_prm_codigo_permissao`,
        { replacements: { idPapel }, type: QueryTypes.SELECT, transaction },
      );
      await this.substituirPermissoesPapel(idPapel, ids, transaction);
      const usuariosAfetados = await banco.query<{ lcr_ses_id_sessao: string }>(
        `UPDATE lcr_sessoes SET lcr_ses_data_revogacao = CURRENT_TIMESTAMP
         WHERE lcr_ses_data_revogacao IS NULL AND lcr_ses_id_usuario IN
           (SELECT lcr_upr_id_usuario FROM lcr_usuarios_papeis WHERE lcr_upr_id_papel = :idPapel)
         RETURNING lcr_ses_id_sessao`,
        { replacements: { idPapel }, type: QueryTypes.SELECT, transaction },
      );
      await this.registrarAuditoria(transaction, ator, correlacao, 'administracao.matriz.atualizada', 'papel', idPapel, {
        nomePapel: papel.lcr_pap_nome_papel,
        permissoesAnteriores: anteriores.map((item) => item.lcr_prm_codigo_permissao),
        idsPermissoesNovas: ids,
        motivo: motivoNormalizado,
        sessoesRevogadas: usuariosAfetados.length,
      });
      await transaction.commit();
    } catch (erro) {
      await transaction.rollback();
      throw erro;
    }
  }

  async alterarStatusUsuario(idUsuario: string, status: string, motivo: string, atorId: string, correlacao: string) {
    if (idUsuario === atorId) throw new ForbiddenException('Não é permitido alterar o próprio acesso pela Administração.');
    if (status !== 'ativo' && status !== 'bloqueado') throw new BadRequestException('Status administrativo inválido.');
    const motivoNormalizado = this.validarMotivo(motivo);
    const banco = this.exigirBanco();
    const transaction = await banco.transaction();
    try {
      const usuario = await ModeloUsuario.findByPk(idUsuario, { transaction, lock: transaction.LOCK.UPDATE });
      if (!usuario) throw new NotFoundException('Usuário não encontrado.');
      const statusAnterior = usuario.lcr_usr_status_usuario;
      if (statusAnterior === status) {
        await transaction.commit();
        return 0;
      }
      if (status === 'bloqueado' && await this.ehAdministradorAtivo(idUsuario, transaction)) {
        await this.bloquearUltimoAdministradorSeNecessario(idUsuario, transaction);
      }
      await usuario.update({ lcr_usr_status_usuario: status, lcr_usr_data_atualizacao: new Date() }, { transaction });
      let sessoesRevogadas = 0;
      if (status === 'bloqueado') {
        const sessoes = await banco.query<{ lcr_ses_id_sessao: string }>(
          `UPDATE lcr_sessoes SET lcr_ses_data_revogacao = CURRENT_TIMESTAMP
           WHERE lcr_ses_id_usuario = :idUsuario AND lcr_ses_data_revogacao IS NULL
           RETURNING lcr_ses_id_sessao`,
          { replacements: { idUsuario }, type: QueryTypes.SELECT, transaction },
        );
        sessoesRevogadas = sessoes.length;
      }
      await this.registrarAuditoria(transaction, atorId, correlacao, `administracao.usuario.${status === 'bloqueado' ? 'bloqueado' : 'ativado'}`, 'usuario', idUsuario, {
        statusAnterior,
        statusNovo: status,
        motivo: motivoNormalizado,
        sessoesRevogadas,
      });
      await transaction.commit();
      return sessoesRevogadas;
    } catch (erro) {
      await transaction.rollback();
      throw erro;
    }
  }

  async definirPapeisUsuario(idUsuario: string, idsPapeis: string[], motivo: string, atorId: string, correlacao: string) {
    if (idUsuario === atorId) throw new ForbiddenException('Não é permitido alterar os próprios papéis pela Administração.');
    const ids = this.validarListaIds(idsPapeis);
    if (ids.length === 0) throw new BadRequestException('O usuário precisa manter pelo menos um papel.');
    const motivoNormalizado = this.validarMotivo(motivo);
    const banco = this.exigirBanco();
    const transaction = await banco.transaction();
    try {
      await this.bloquearPapelAdministrador(transaction);
      const usuario = await ModeloUsuario.findByPk(idUsuario, { transaction, lock: transaction.LOCK.UPDATE });
      if (!usuario) throw new NotFoundException('Usuário não encontrado.');
      const papeisNovos = await ModeloPapel.findAll({
        where: { lcr_pap_id_papel: ids, lcr_pap_status_papel: 'ativo' },
        transaction, lock: transaction.LOCK.UPDATE,
      });
      if (papeisNovos.length !== ids.length) throw new BadRequestException('Um ou mais papéis não existem ou estão inativos.');
      const atuais = await banco.query<{ lcr_upr_id_papel: string; lcr_pap_nome_papel: string }>(
        `SELECT up.lcr_upr_id_papel, p.lcr_pap_nome_papel FROM lcr_usuarios_papeis up
         INNER JOIN lcr_papeis p ON p.lcr_pap_id_papel = up.lcr_upr_id_papel
         WHERE up.lcr_upr_id_usuario = :idUsuario FOR UPDATE OF up`,
        { replacements: { idUsuario }, type: QueryTypes.SELECT, transaction },
      );
      const atualEraAdmin = atuais.some((p) => p.lcr_pap_nome_papel === 'administrador');
      const novoEhAdmin = papeisNovos.some((p) => p.lcr_pap_nome_papel === 'administrador');
      if (atualEraAdmin && !novoEhAdmin && usuario.lcr_usr_status_usuario === 'ativo') {
        await this.bloquearUltimoAdministradorSeNecessario(idUsuario, transaction);
      }
      await banco.query('DELETE FROM lcr_usuarios_papeis WHERE lcr_upr_id_usuario = :idUsuario', {
        replacements: { idUsuario }, transaction,
      });
      for (const idPapel of ids) {
        await banco.query(
          `INSERT INTO lcr_usuarios_papeis
           (lcr_upr_id_usuario_papel, lcr_upr_id_usuario, lcr_upr_id_papel, lcr_upr_data_atribuicao)
           VALUES (:id, :idUsuario, :idPapel, CURRENT_TIMESTAMP)`,
          { replacements: { id: randomUUID(), idUsuario, idPapel }, transaction },
        );
      }
      const sessoes = await banco.query<{ lcr_ses_id_sessao: string }>(
        `UPDATE lcr_sessoes SET lcr_ses_data_revogacao = CURRENT_TIMESTAMP
         WHERE lcr_ses_id_usuario = :idUsuario AND lcr_ses_data_revogacao IS NULL
         RETURNING lcr_ses_id_sessao`,
        { replacements: { idUsuario }, type: QueryTypes.SELECT, transaction },
      );
      await this.registrarAuditoria(transaction, atorId, correlacao, 'administracao.usuario.papeis_atualizados', 'usuario', idUsuario, {
        papeisAnteriores: atuais.map((item) => item.lcr_pap_nome_papel),
        idsPapeisNovos: ids,
        motivo: motivoNormalizado,
        sessoesRevogadas: sessoes.length,
      });
      await transaction.commit();
    } catch (erro) {
      await transaction.rollback();
      throw erro;
    }
  }

  async revogarSessoesUsuario(idUsuario: string, motivo: string, atorId: string, correlacao: string): Promise<number> {
    const motivoNormalizado = this.validarMotivo(motivo);
    const banco = this.exigirBanco();
    const transaction = await banco.transaction();
    try {
      const usuario = await ModeloUsuario.findByPk(idUsuario, { transaction, lock: transaction.LOCK.UPDATE });
      if (!usuario) throw new NotFoundException('Usuário não encontrado.');
      const sessoes = await ModeloSessao.update(
        { lcr_ses_data_revogacao: new Date() },
        { where: { lcr_ses_id_usuario: idUsuario, lcr_ses_data_revogacao: null }, transaction },
      );
      const quantidade = Number(sessoes[0] ?? 0);
      await this.registrarAuditoria(transaction, atorId, correlacao, 'administracao.usuario.sessoes_revogadas', 'usuario', idUsuario, {
        quantidade,
        motivo: motivoNormalizado,
      });
      await transaction.commit();
      return quantidade;
    } catch (erro) {
      await transaction.rollback();
      throw erro;
    }
  }

  private async substituirPermissoesPapel(idPapel: string, idsPermissoes: string[], transaction: Transaction) {
    const banco = this.exigirBanco();
    await banco.query('DELETE FROM lcr_papeis_permissoes WHERE lcr_ppm_id_papel = :idPapel', {
      replacements: { idPapel }, transaction,
    });
    for (const idPermissao of idsPermissoes) {
      await banco.query(
        `INSERT INTO lcr_papeis_permissoes
         (lcr_ppm_id_papel_permissao, lcr_ppm_id_papel, lcr_ppm_id_permissao, lcr_ppm_data_atribuicao)
         VALUES (:id, :idPapel, :idPermissao, CURRENT_TIMESTAMP)`,
        { replacements: { id: randomUUID(), idPapel, idPermissao }, transaction },
      );
    }
  }

  private async validarPermissoes(ids: string[], transaction: Transaction) {
    if (ids.length === 0) return;
    const permissoes = await ModeloPermissao.findAll({
      where: { lcr_prm_id_permissao: ids, lcr_prm_status_permissao: 'ativo' },
      transaction,
    });
    if (permissoes.length !== ids.length) throw new BadRequestException('Uma ou mais permissões não existem ou estão inativas.');
  }

  private async rejeitarPermissaoExclusiva(ids: string[], transaction: Transaction) {
    if (ids.length === 0) return;
    const permissoes = await ModeloPermissao.findAll({
      where: { lcr_prm_id_permissao: ids },
      transaction,
    });
    if (permissoes.some((permissao) => permissao.lcr_prm_codigo_permissao === CODIGO_GERIR_ACESSOS)) {
      throw new ForbiddenException('A permissão de gestão de acessos é exclusiva do papel administrador.');
    }
  }

  private async ehAdministradorAtivo(idUsuario: string, transaction: Transaction): Promise<boolean> {
    const [resultado] = await this.exigirBanco().query<{ quantidade: number }>(
      `SELECT COUNT(*)::int AS quantidade FROM lcr_usuarios_papeis up
       INNER JOIN lcr_papeis p ON p.lcr_pap_id_papel = up.lcr_upr_id_papel
       WHERE up.lcr_upr_id_usuario = :idUsuario AND p.lcr_pap_nome_papel = 'administrador'
         AND p.lcr_pap_status_papel = 'ativo'`,
      { replacements: { idUsuario }, type: QueryTypes.SELECT, transaction },
    );
    return Number(resultado?.quantidade ?? 0) > 0;
  }

  private async bloquearUltimoAdministradorSeNecessario(idUsuario: string, transaction: Transaction) {
    await this.bloquearPapelAdministrador(transaction);
    const [resultado] = await this.exigirBanco().query<{ quantidade: number }>(
      `SELECT COUNT(DISTINCT u.lcr_usr_id_usuario)::int AS quantidade
       FROM lcr_usuarios u
       INNER JOIN lcr_usuarios_papeis up ON up.lcr_upr_id_usuario = u.lcr_usr_id_usuario
       INNER JOIN lcr_papeis p ON p.lcr_pap_id_papel = up.lcr_upr_id_papel
       WHERE u.lcr_usr_status_usuario = 'ativo' AND p.lcr_pap_nome_papel = 'administrador'
         AND p.lcr_pap_status_papel = 'ativo'`,
      { type: QueryTypes.SELECT, transaction },
    );
    if (Number(resultado?.quantidade ?? 0) <= 1) {
      throw new ConflictException('Não é possível remover o último administrador ativo da plataforma.');
    }
  }

  private async bloquearPapelAdministrador(transaction: Transaction) {
    const [papel] = await this.exigirBanco().query<{ lcr_pap_id_papel: string }>(
      `SELECT lcr_pap_id_papel FROM lcr_papeis WHERE lcr_pap_nome_papel = 'administrador' FOR UPDATE`,
      { type: QueryTypes.SELECT, transaction },
    );
    if (!papel) throw new ServiceUnavailableException('Papel administrador do sistema não está inicializado.');
  }

  private async registrarAuditoria(
    transaction: Transaction,
    ator: string,
    correlacao: string,
    tipoEvento: string,
    recurso: string,
    idRecurso: string,
    detalhes: Record<string, unknown>,
  ) {
    await this.auditoria.registrar({
      idUsuario: ator,
      tipoEvento,
      recursoEvento: recurso,
      idRecurso,
      idCorrelacao: correlacao || randomUUID(),
      detalhesEvento: detalhes,
    }, transaction);
  }

  private async contar(sql: string): Promise<number> {
    const [resultado] = await this.exigirBanco().query<{ quantidade: number }>(sql, { type: QueryTypes.SELECT });
    return Number(resultado?.quantidade ?? 0);
  }

  private exigirBanco(): Sequelize {
    if (!this.banco) throw new ServiceUnavailableException('Banco de dados indisponível.');
    return this.banco;
  }

  private validarNomePapel(valor: string): string {
    const nome = valor.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{2,59}$/.test(nome)) {
      throw new BadRequestException('Use um identificador de 3 a 60 caracteres, começando por letra e contendo apenas minúsculas, números ou _.');
    }
    return nome;
  }

  private validarDescricao(valor: string): string {
    const descricao = valor.trim();
    if (descricao.length < 3 || descricao.length > 1000) throw new BadRequestException('A descrição deve ter entre 3 e 1000 caracteres.');
    return descricao;
  }

  private validarMotivo(valor: string): string {
    const motivo = valor.trim();
    if (motivo.length < 5 || motivo.length > 500) throw new BadRequestException('Informe um motivo de 5 a 500 caracteres para registrar a ação administrativa.');
    return motivo;
  }

  private validarListaIds(ids: string[]): string[] {
    if (!Array.isArray(ids)) throw new BadRequestException('A lista informada é inválida.');
    const normalizados = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (normalizados.length > 100 || normalizados.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
      throw new BadRequestException('A lista contém identificadores inválidos.');
    }
    return normalizados;
  }

  private rejeitarPapelSistema(nome: string) {
    if (PAPEIS_SISTEMA_PROTEGIDOS.has(nome)) {
      throw new ForbiddenException('Os papéis base do sistema não podem ser renomeados, duplicados ou substituídos.');
    }
  }

  private validarStatusUsuarioFiltro(status?: string): string {
    if (!status || status === 'todos') return '';
    if (!['ativo', 'bloqueado', 'anonimizado'].includes(status)) throw new BadRequestException('Filtro de status inválido.');
    return status;
  }

  private limitar(valor: number | undefined, padrao: number): number {
    return Math.max(1, Math.min(LIMITE_PAGINA_MAXIMO, Math.floor(valor ?? padrao)));
  }

  private iso(valor: unknown): string {
    const data = valor instanceof Date ? valor : new Date(String(valor));
    return Number.isNaN(data.getTime()) ? '' : data.toISOString();
  }

  private jsonArray(valor: unknown): Record<string, unknown>[] {
    if (Array.isArray(valor)) return valor as Record<string, unknown>[];
    if (typeof valor === 'string') {
      try {
        const convertido: unknown = JSON.parse(valor);
        return Array.isArray(convertido) ? convertido as Record<string, unknown>[] : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private stringArray(valor: unknown): string[] {
    if (Array.isArray(valor)) return valor.map(String).filter(Boolean);
    return [];
  }
}
