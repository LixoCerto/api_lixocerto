import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

@Catch()
export class FiltroErroGrpc implements ExceptionFilter {
  catch(erro: unknown, _host: ArgumentsHost): void {
    // A implementação final converterá erros de domínio em status gRPC padronizados.
    console.error('[erro-grpc]', erro);
  }
}
