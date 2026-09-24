import 'reflect-metadata';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ModuloPrincipal } from './modulo_principal.js';

async function iniciarAplicacao(): Promise<void> {
  const aplicacao = await NestFactory.createMicroservice<MicroserviceOptions>(ModuloPrincipal, {
    transport: Transport.GRPC,
    options: {
      package: 'lixo_certo.v1',
      protoPath: [
        join(process.cwd(), 'contratos/lixo_certo/v1/servico_saude.proto'),
        join(process.cwd(), 'contratos/lixo_certo/v1/servico_autenticacao.proto'),
        join(process.cwd(), 'contratos/lixo_certo/v1/servico_materiais.proto'),
        join(process.cwd(), 'contratos/lixo_certo/v1/servico_pontos_coleta.proto'),
        join(process.cwd(), 'contratos/lixo_certo/v1/servico_questionarios.proto'),
        join(process.cwd(), 'contratos/lixo_certo/v1/servico_gamificacao.proto'),
        join(process.cwd(), 'contratos/lixo_certo/v1/servico_avaliacao_usabilidade.proto'),
        join(process.cwd(), 'contratos/lixo_certo/v1/servico_desafios.proto'),
        join(process.cwd(), 'contratos/lixo_certo/v1/servico_auditoria.proto'),
        join(process.cwd(), 'contratos/lixo_certo/v1/servico_administracao.proto'),
      ],
      url: `0.0.0.0:${process.env.PORTA_GRPC ?? '50051'}`,
      loader: {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    },
  });

  await aplicacao.listen();
}

void iniciarAplicacao();
