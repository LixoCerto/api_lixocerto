import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { QueryTypes, Sequelize } from 'sequelize';
import { UsuarioAutenticado } from '../../comum/autenticacao/usuario_autenticado.js';
import { ModeloSessao } from '../../infraestrutura/banco/modelos/sessao.modelo.js';
import { ModeloUsuario } from '../../infraestrutura/banco/modelos/usuario.modelo.js';
import type { IdentidadeGoogleVerificada } from '../autenticacao/identidade_google.js';

const PAPEIS_PERMITIDOS = ['usuario', 'pesquisador', 'revisor', 'administrador'] as const;
type PapelPermitido = (typeof PAPEIS_PERMITIDOS)[number];

export interface CredencialUsuarioLocal {
  idInterno: string;
  idExterno: string;
  nome: string;
  email: string;
  hashSenha: string | null;
  status: 'ativo' | 'bloqueado' | 'anonimizado';
  emailVerificado: boolean;
}

@Injectable()
export class ServicoUsuarios {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async obterIdInterno(idExterno: string): Promise<string | null> {
    if (!this.banco) return null;
    const usuario = await ModeloUsuario.findOne({ where: { lcr_usr_id_externo: idExterno } });
    return usuario?.lcr_usr_id_usuario ?? null;
  }

  async obterCredencialPorEmail(email: string): Promise<CredencialUsuarioLocal | null> {
    if (!this.banco) return null;
    const usuario = await ModeloUsuario.findOne({ where: { lcr_usr_email: email.trim().toLowerCase() } });
    if (!usuario) return null;
    return {
      idInterno: usuario.lcr_usr_id_usuario,
      idExterno: usuario.lcr_usr_id_externo,
      nome: usuario.lcr_usr_nome,
      email: usuario.lcr_usr_email,
      hashSenha: usuario.lcr_usr_hash_senha,
      status: usuario.lcr_usr_status_usuario,
      emailVerificado: usuario.lcr_usr_email_verificado_em !== null,
    };
  }

  async obterCredencialPorIdInterno(idInterno: string): Promise<CredencialUsuarioLocal | null> {
    if (!this.banco) return null;
    const usuario = await ModeloUsuario.findByPk(idInterno);
    if (!usuario) return null;
    return {
      idInterno: usuario.lcr_usr_id_usuario,
      idExterno: usuario.lcr_usr_id_externo,
      nome: usuario.lcr_usr_nome,
      email: usuario.lcr_usr_email,
      hashSenha: usuario.lcr_usr_hash_senha,
      status: usuario.lcr_usr_status_usuario,
      emailVerificado: usuario.lcr_usr_email_verificado_em !== null,
    };
  }

  /** Substitui o hash da senha. A senha em texto claro nunca é persistida. */
  async definirHashSenha(idInterno: string, hashSenha: string): Promise<boolean> {
    if (!this.banco) return false;
    const [quantidade] = await ModeloUsuario.update(
      { lcr_usr_hash_senha: hashSenha },
      { where: { lcr_usr_id_usuario: idInterno } },
    );
    return quantidade > 0;
  }

  /** Marca o e-mail como confirmado e devolve o endereço confirmado. */
  async marcarEmailVerificado(idInterno: string): Promise<string | null> {
    if (!this.banco) return null;
    const usuario = await ModeloUsuario.findByPk(idInterno);
    if (!usuario) return null;
    await usuario.update({ lcr_usr_email_verificado_em: new Date() });
    return usuario.lcr_usr_email;
  }

  /**
   * Revoga todas as sessões abertas do usuário.
   * Usado após a redefinição de senha, para encerrar qualquer acesso obtido com a senha anterior.
   */
  async revogarSessoes(idInterno: string): Promise<number> {
    if (!this.banco) return 0;
    const [quantidade] = await ModeloSessao.update(
      { lcr_ses_data_revogacao: new Date() },
      { where: { lcr_ses_id_usuario: idInterno, lcr_ses_data_revogacao: null } },
    );
    return quantidade;
  }

  async cadastrarUsuarioLocal(dados: { nome: string; email: string; hashSenha: string }): Promise<UsuarioAutenticado> {
    if (!this.banco) throw new Error('Banco de dados indisponivel');
    const email = dados.email.trim().toLowerCase();
    const existente = await ModeloUsuario.findOne({ where: { lcr_usr_email: email } });
    if (existente) throw new Error('Email ja cadastrado');

    const usuario = await ModeloUsuario.create({
      lcr_usr_id_externo: `local:${randomUUID()}`,
      lcr_usr_nome: dados.nome.trim(),
      lcr_usr_email: email,
      lcr_usr_hash_senha: dados.hashSenha,
      lcr_usr_email_verificado_em: null,
      lcr_usr_status_usuario: 'ativo',
      lcr_usr_data_ultimo_acesso: new Date(),
    });

    const papel = await this.banco.query<{ lcr_pap_id_papel: string }>(
      `SELECT lcr_pap_id_papel
       FROM lcr_papeis
       WHERE lcr_pap_nome_papel = 'usuario' AND lcr_pap_status_papel = 'ativo'
       LIMIT 1`,
      { type: QueryTypes.SELECT },
    );
    if (!papel[0]) throw new Error('Papel usuario nao configurado');
    await this.banco.query(
      `INSERT INTO lcr_usuarios_papeis (
        lcr_upr_id_usuario_papel, lcr_upr_id_usuario, lcr_upr_id_papel, lcr_upr_data_atribuicao
      ) VALUES (gen_random_uuid(), :idUsuario, :idPapel, CURRENT_TIMESTAMP)`,
      { replacements: { idUsuario: usuario.lcr_usr_id_usuario, idPapel: papel[0].lcr_pap_id_papel } },
    );
    return this.obterIdentidadeLocal(usuario.lcr_usr_id_externo) as Promise<UsuarioAutenticado>;
  }

  async autenticarComGoogle(dados: IdentidadeGoogleVerificada): Promise<UsuarioAutenticado> {
    if (!this.banco) throw new Error('Banco de dados indisponivel');
    const email = dados.email.trim().toLowerCase();
    const transacao = await this.banco.transaction();
    let idExterno: string;

    try {
      let usuario = await ModeloUsuario.findOne({
        where: { lcr_usr_google_subject: dados.sub },
        transaction: transacao,
        lock: transacao.LOCK.UPDATE,
      });

      if (!usuario) {
        usuario = await ModeloUsuario.findOne({
          where: { lcr_usr_email: email },
          transaction: transacao,
          lock: transacao.LOCK.UPDATE,
        });

        if (usuario) {
          if (usuario.lcr_usr_google_subject && usuario.lcr_usr_google_subject !== dados.sub) {
            throw new Error('GOOGLE_ACCOUNT_CONFLICT');
          }
          if (!usuario.lcr_usr_google_subject && !dados.emailAutoritativo) {
            throw new Error('GOOGLE_LINK_REQUIRED');
          }
          await usuario.update({
            lcr_usr_google_subject: dados.sub,
            lcr_usr_email_verificado_em: usuario.lcr_usr_email_verificado_em ?? new Date(),
          }, { transaction: transacao });
        } else {
          usuario = await ModeloUsuario.create({
            lcr_usr_id_externo: `google:${dados.sub}`,
            lcr_usr_nome: dados.nome.trim().slice(0, 180),
            lcr_usr_email: email,
            lcr_usr_hash_senha: null,
            lcr_usr_email_verificado_em: new Date(),
            lcr_usr_google_subject: dados.sub,
            lcr_usr_status_usuario: 'ativo',
            lcr_usr_data_ultimo_acesso: new Date(),
          }, { transaction: transacao });

          const papeis = await this.banco.query<{ lcr_pap_id_papel: string }>(
            `SELECT lcr_pap_id_papel
             FROM lcr_papeis
             WHERE lcr_pap_nome_papel = 'usuario' AND lcr_pap_status_papel = 'ativo'
             LIMIT 1`,
            { type: QueryTypes.SELECT, transaction: transacao },
          );
          if (!papeis[0]) throw new Error('Papel usuario nao configurado');
          await this.banco.query(
            `INSERT INTO lcr_usuarios_papeis (
              lcr_upr_id_usuario_papel, lcr_upr_id_usuario, lcr_upr_id_papel, lcr_upr_data_atribuicao
            ) VALUES (gen_random_uuid(), :idUsuario, :idPapel, CURRENT_TIMESTAMP)`,
            {
              replacements: { idUsuario: usuario.lcr_usr_id_usuario, idPapel: papeis[0].lcr_pap_id_papel },
              transaction: transacao,
            },
          );
        }
      }

      if (usuario.lcr_usr_status_usuario !== 'ativo') throw new Error('Usuario sem acesso ativo');
      idExterno = usuario.lcr_usr_id_externo;
      await transacao.commit();
    } catch (erro) {
      await transacao.rollback().catch(() => undefined);
      const concorrente = await ModeloUsuario.findOne({ where: { lcr_usr_google_subject: dados.sub } }).catch(() => null);
      if (concorrente?.lcr_usr_status_usuario === 'ativo') {
        const identidadeConcorrente = await this.obterIdentidadeLocal(concorrente.lcr_usr_id_externo);
        if (identidadeConcorrente) return identidadeConcorrente;
      }
      throw erro;
    }

    const identidade = await this.obterIdentidadeLocal(idExterno);
    if (!identidade) throw new Error('Identidade Google sem usuario local');
    return identidade;
  }

  async obterIdentidadeLocal(idExterno: string): Promise<UsuarioAutenticado | null> {
    if (!this.banco) return null;
    const usuario = await ModeloUsuario.findOne({ where: { lcr_usr_id_externo: idExterno } });
    if (!usuario) return null;
    if (usuario.lcr_usr_status_usuario !== 'ativo') throw new Error('Usuario sem acesso ativo');

    const papeis = await this.banco.query<{ lcr_pap_nome_papel: string }>(
      `SELECT papel.lcr_pap_nome_papel
       FROM lcr_papeis papel
       INNER JOIN lcr_usuarios_papeis relacao ON relacao.lcr_upr_id_papel = papel.lcr_pap_id_papel
       WHERE relacao.lcr_upr_id_usuario = :idUsuario AND papel.lcr_pap_status_papel = 'ativo'
       ORDER BY CASE papel.lcr_pap_nome_papel
         WHEN 'administrador' THEN 1 WHEN 'revisor' THEN 2 WHEN 'pesquisador' THEN 3
         WHEN 'usuario' THEN 4 ELSE 5 END`,
      { replacements: { idUsuario: usuario.lcr_usr_id_usuario }, type: QueryTypes.SELECT },
    );
    const permissoes = await this.banco.query<{ lcr_prm_codigo_permissao: string }>(
      `SELECT DISTINCT permissao.lcr_prm_codigo_permissao
       FROM lcr_permissoes permissao
       INNER JOIN lcr_papeis_permissoes papel_permissao ON papel_permissao.lcr_ppm_id_permissao = permissao.lcr_prm_id_permissao
       INNER JOIN lcr_usuarios_papeis relacao ON relacao.lcr_upr_id_papel = papel_permissao.lcr_ppm_id_papel
       WHERE relacao.lcr_upr_id_usuario = :idUsuario AND permissao.lcr_prm_status_permissao = 'ativo'`,
      { replacements: { idUsuario: usuario.lcr_usr_id_usuario }, type: QueryTypes.SELECT },
    );
    await usuario.update({ lcr_usr_data_ultimo_acesso: new Date() });
    return {
      idExterno: usuario.lcr_usr_id_externo,
      nome: usuario.lcr_usr_nome,
      email: usuario.lcr_usr_email,
      papeis: papeis.map(item => item.lcr_pap_nome_papel),
      permissoes: permissoes.map(item => item.lcr_prm_codigo_permissao),
      emailVerificado: Boolean(usuario.lcr_usr_email_verificado_em),
    };
  }

  async sincronizarUsuario(identidade: UsuarioAutenticado): Promise<UsuarioAutenticado> {
    if (!this.banco) return identidade;

    const [usuario] = await ModeloUsuario.findOrCreate({
      where: { lcr_usr_id_externo: identidade.idExterno },
      defaults: {
        lcr_usr_id_externo: identidade.idExterno,
        lcr_usr_nome: identidade.nome,
        lcr_usr_email: identidade.email,
        lcr_usr_hash_senha: null,
        lcr_usr_email_verificado_em: null,
        lcr_usr_status_usuario: 'ativo',
        lcr_usr_data_ultimo_acesso: new Date(),
      },
    });
    if (usuario.lcr_usr_status_usuario !== 'ativo') throw new Error('Usuario sem acesso ativo');
    await usuario.update({ lcr_usr_nome: identidade.nome, lcr_usr_email: identidade.email, lcr_usr_data_ultimo_acesso: new Date() });

    const papeisSolicitados = new Set<PapelPermitido>(['usuario']);
    for (const papel of identidade.papeis) {
      if ((PAPEIS_PERMITIDOS as readonly string[]).includes(papel)) papeisSolicitados.add(papel as PapelPermitido);
    }
    const nomesPapeis = [...papeisSolicitados];
    const papeisBanco = await this.banco.query<{ lcr_pap_id_papel: string; lcr_pap_nome_papel: PapelPermitido }>(
      `SELECT lcr_pap_id_papel, lcr_pap_nome_papel FROM lcr_papeis
       WHERE lcr_pap_nome_papel IN (:nomesPapeis) AND lcr_pap_status_papel = 'ativo'`,
      { replacements: { nomesPapeis }, type: QueryTypes.SELECT },
    );
    const idsPapeis = papeisBanco.map(item => item.lcr_pap_id_papel);
    if (idsPapeis.length > 0) {
      await this.banco.query(
        `DELETE FROM lcr_usuarios_papeis relacao WHERE relacao.lcr_upr_id_usuario = :idUsuario
         AND relacao.lcr_upr_id_papel NOT IN (:idsPapeis)`,
        { replacements: { idUsuario: usuario.lcr_usr_id_usuario, idsPapeis } },
      );
      for (const idPapel of idsPapeis) {
        await this.banco.query(
          `INSERT INTO lcr_usuarios_papeis (lcr_upr_id_usuario_papel, lcr_upr_id_usuario, lcr_upr_id_papel, lcr_upr_data_atribuicao)
           SELECT gen_random_uuid(), :idUsuario, :idPapel, CURRENT_TIMESTAMP
           WHERE NOT EXISTS (SELECT 1 FROM lcr_usuarios_papeis existente
             WHERE existente.lcr_upr_id_usuario = :idUsuario AND existente.lcr_upr_id_papel = :idPapel)`,
          { replacements: { idUsuario: usuario.lcr_usr_id_usuario, idPapel } },
        );
      }
    }
    return (await this.obterIdentidadeLocal(identidade.idExterno)) ?? identidade;
  }
}
