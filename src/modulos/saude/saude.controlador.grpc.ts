import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

@Controller()
export class ControladorGrpcSaude {
  @GrpcMethod('ServicoSaude', 'Verificar')
  verificar(): { status_servico: string; data_verificacao: string } {
    return {
      status_servico: 'saudavel',
      data_verificacao: new Date().toISOString(),
    };
  }
}
