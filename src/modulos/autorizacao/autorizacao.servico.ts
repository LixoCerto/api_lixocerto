import { Injectable } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { UsuarioAutenticado } from '../../comum/autenticacao/usuario_autenticado.js';

@Injectable()
export class ServicoAutorizacao {
  temPermissao(usuario: UsuarioAutenticado, codigoPermissao: string): boolean {
    return usuario.papeis.includes('administrador') || usuario.permissoes.includes(codigoPermissao);
  }

  exigirPermissao(usuario: UsuarioAutenticado, codigoPermissao: string): void {
    if (!this.temPermissao(usuario, codigoPermissao)) {
      throw new ForbiddenException('Permissao insuficiente para esta operacao');
    }
  }
}
