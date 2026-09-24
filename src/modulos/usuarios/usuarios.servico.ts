import { Inject, Injectable } from '@nestjs/common';
import { QueryTypes, Sequelize } from 'sequelize';
import { UsuarioAutenticado } from '../../comum/autenticacao/usuario_autenticado.js';
import { ModeloUsuario } from '../../infraestrutura/banco/modelos/usuario.modelo.js';

@Injectable()
export class ServicoUsuarios {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

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

    await this.banco.query(
      `INSERT INTO lcr_usuarios_papeis (
        lcr_upr_id_usuario_papel,
        lcr_upr_id_usuario,
        lcr_upr_id_papel,
        lcr_upr_data_atribuicao
      )
      SELECT gen_random_uuid(), :idUsuario, lcr_pap_id_papel, CURRENT_TIMESTAMP
      FROM lcr_papeis
      WHERE lcr_pap_nome_papel = 'usuario'
        AND lcr_pap_status_papel = 'ativo'
        AND NOT EXISTS (
          SELECT 1 FROM lcr_usuarios_papeis existente
          WHERE existente.lcr_upr_id_usuario = :idUsuario
            AND existente.lcr_upr_id_papel = lcr_pap_id_papel
        )`,
      { replacements: { idUsuario: usuario.lcr_usr_id_usuario } },
    );

    const papeis = await this.banco.query<{ lcr_pap_nome_papel: string }>(
      `SELECT papel.lcr_pap_nome_papel
       FROM lcr_papeis papel
       INNER JOIN lcr_usuarios_papeis relacao ON relacao.lcr_upr_id_papel = papel.lcr_pap_id_papel
       WHERE relacao.lcr_upr_id_usuario = :idUsuario AND papel.lcr_pap_status_papel = 'ativo'`,
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
