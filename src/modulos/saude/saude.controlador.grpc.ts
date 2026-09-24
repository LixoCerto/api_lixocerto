import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ServicoSaude } from './saude.servico.js';

@Controller()
export class ControladorGrpcSaude {
  constructor(private readonly servico: ServicoSaude) {}

  @GrpcMethod('ServicoSaude', 'Verificar')
  async verificar(): Promise<{
    status_servico: string;
    data_verificacao: string;
    status_banco: string;
    status_redis: string;
    versao_api: string;
  }> {
    const saude = await this.servico.verificar();
    return {
      status_servico: saude.statusServico,
      data_verificacao: saude.dataVerificacao,
      status_banco: saude.statusBanco,
      status_redis: saude.statusRedis,
      versao_api: saude.versaoApi,
    };
  }
}
