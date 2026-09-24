import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class GuardaAutenticacao implements CanActivate {
  canActivate(contexto: ExecutionContext): boolean {
    const requisicao = contexto.switchToRpc().getContext<{ usuarioAutenticado?: unknown }>();
    if (!requisicao?.usuarioAutenticado) {
      throw new UnauthorizedException('Autenticacao obrigatoria');
    }
    return true;
  }
}
