import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class GuardaPermissao implements CanActivate {
  canActivate(contexto: ExecutionContext): boolean {
    const requisicao = contexto.switchToRpc().getContext<{ permissaoAutorizada?: boolean }>();
    if (!requisicao?.permissaoAutorizada) {
      throw new ForbiddenException('Permissao insuficiente');
    }
    return true;
  }
}
