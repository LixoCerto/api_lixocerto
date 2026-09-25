import { Inject, Injectable } from '@nestjs/common';
import { QueryTypes, Sequelize } from 'sequelize';
import { UsuarioAutenticado } from '../../comum/autenticacao/usuario_autenticado.js';
import { ModeloUsuario } from '../../infraestrutura/banco/modelos/usuario.modelo.js';

const PAPEIS_PERMITIDOS = ['usuario', 'pesquisador', 'revisor', 'administrador'] as const;

type PapelPermitido = (typeof PAPEIS_PERMITIDOS)[number];

@Injectable()
export class ServicoUsuarios {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async obterIdInterno(idExterno: string): Promise<string | null> {
    if (!this.banco) return null;
    const usuario = await ModeloUsuario.findOne({ where: { lcr_usr_id_externo: idExterno } });
    return usuario?.lcr_usr_id_usuario ?? null;
  }

  async sincronizarUsuario(identidade: UsuarioAutenticado): Promise<UsuarioAutenticado> {
    if (!this.banco) return identidade;

    const [usuario] = await ModeloUsuario.findOrCreate({
      where: { lcr_usr_id_externo: identidade.idExterno },
      defaults: {
        lcr_usr_id_externo: identidade.idExterno,
        lcr_usr_nome: identidade.nome,
        lcr_usr_email: identidade.email,
        lcr_usr_status_usuario: 'ativo',
        lcr_usr_data_ultimo_acesso: new Date(),
      },
    });

    if (usuario.lcr_usr_status_usuario !== 'ativo') {
      throw new Error('Usuario sem acesso ativo');
    }

    await usuario.update({
      lcr_usr_nome: identidade.nome,
      lcr_usr_email: identidade.email,
      lcr_usr_data_ultimo_acesso: new Date(),
    });

    const papeisSolicitados = new Set<PapelPermitido>(['usuario']);
    for (const papel of identidade.papeis) {
      if ((PAPEIS_PERMITIDOS as readonly string[]).includes(papel)) papeisSolicitados.add(papel as PapelPermitido);
    }
    const nomesPapeis = [...papeisSolicitados];
    const papeisBanco = await this.banco.query<{ lcr_pap_id_papel: string; lcr_pap_nome_papel: PapelPermitido }>(
      `SELECT lcr_pap_id_papel, lcr_pap_nome_papel
       FROM lcr_papeis
       WHERE lcr_pap_nome_papel IN (:nomesPapeis)
         AND lcr_pap_status_papel = 'ativo'`,
      { replacements: { nomesPapeis }, type: QueryTypes.SELECT },
    );
    const idsPapeis = papeisBanco.map(papel => papel.lcr_pap_id_papel);

    if (idsPapeis.length > 0) {
      await this.banco.query(
        `DELETE FROM lcr_usuarios_papeis relacao
         WHERE relacao.lcr_upr_id_usuario = :idUsuario
           AND relacao.lcr_upr_id_papel NOT IN (:idsPapeis)`,
        { replacements: { idUsuario: usuario.lcr_usr_id_usuario, idsPapeis } },
      );

      for (const idPapel of idsPapeis) {
        await this.banco.query(
          `INSERT INTO lcr_usuarios_papeis (
            lcr_upr_id_usuario_papel,
            lcr_upr_id_usuario,
            lcr_upr_id_papel,
            lcr_upr_data_atribuicao
          )
          SELECT gen_random_uuid(), :idUsuario, :idPapel, CURRENT_TIMESTAMP
          WHERE NOT EXISTS (
            SELECT 1 FROM lcr_usuarios_papeis existente
            WHERE existente.lcr_upr_id_usuario = :idUsuario
              AND existente.lcr_upr_id_papel = :idPapel
          )`,
          { replacements: { idUsuario: usuario.lcr_usr_id_usuario, idPapel } },
        );
      }
    }

    const papeis = await this.banco.query<{ lcr_pap_nome_papel: string }>(
      `SELECT papel.lcr_pap_nome_papel
       FROM lcr_papeis papel
       INNER JOIN lcr_usuarios_papeis relacao ON relacao.lcr_upr_id_papel = papel.lcr_pap_id_papel
       WHERE relacao.lcr_upr_id_usuario = :idUsuario AND papel.lcr_pap_status_papel = 'ativo'
       ORDER BY CASE papel.lcr_pap_nome_papel
         WHEN 'administrador' THEN 1
         WHEN 'revisor' THEN 2
         WHEN 'pesquisador' THEN 3
         WHEN 'usuario' THEN 4
         ELSE 5
       END`,
      { replacements: { idUsuario: usuario.lcr_usr_id_usuario }, type: QueryTypes.SELECT },
    );
    const permissoes = await this.banco.query<{ lcr_prm_codigo_permissao: string }>(
      `SELECT DISTINCT permissao.lcr_prm_codigo_permissao
       FROM lcr_permissoes permissao
       INNER JOIN lcr_papeis_permissoes papel_permissao ON papel_permissao.lcr_ppm_id_permissao = permissao.lcr_prm_id_permissao
       INNER JOIN lcr_usuarios_papeis relacao ON relacao.lcr_upr_id_papel = papel_permissao.lcr_ppm_id_papel
       WHERE relacao.lcr_upr_id_usuario = :idUsuario
         AND permissao.lcr_prm_status_permissao = 'ativo'`,
      { replacements: { idUsuario: usuario.lcr_usr_id_usuario }, type: QueryTypes.SELECT },
    );

    return {
      ...identidade,
      papeis: papeis.map(papel => papel.lcr_pap_nome_papel),
      permissoes: permissoes.map(permissao => permissao.lcr_prm_codigo_permissao),
    };
  }
}
