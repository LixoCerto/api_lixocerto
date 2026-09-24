import { Injectable } from '@nestjs/common';
import { UsuarioAutenticado } from '../../comum/autenticacao/usuario_autenticado.js';
import { ServicoUsuarios } from '../usuarios/usuarios.servico.js';
import { VerificadorJwtServico } from './verificador_jwt.servico.js';

@Injectable()
export class ServicoAutenticacao {
  constructor(
    private readonly verificadorJwt: VerificadorJwtServico,
    private readonly usuarios: ServicoUsuarios,
  ) {}

  async obterIdentidadeAtual(valorAutorizacao?: string): Promise<UsuarioAutenticado> {
    const token = this.verificadorJwt.extrairToken(valorAutorizacao);
    const identidade = await this.verificadorJwt.verificar(token);
    return this.usuarios.sincronizarUsuario(identidade);
  }
}
