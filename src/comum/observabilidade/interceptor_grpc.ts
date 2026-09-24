import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { registrarEvento } from './registrador.js';

@Injectable()
export class InterceptorObservabilidade implements NestInterceptor {
  intercept(contexto: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    const inicio = Date.now();
    const handler = contexto.getHandler()?.name ?? 'desconhecido';
    return proximo.handle().pipe(
      tap({
        next: () => registrarEvento('grpc_chamada_concluida', { handler, duracaoMs: Date.now() - inicio }),
        error: erro => registrarEvento('grpc_chamada_falhou', {
          handler,
          duracaoMs: Date.now() - inicio,
          tipoErro: erro instanceof Error ? erro.name : 'erro_desconhecido',
        }),
      }),
    );
  }
}
