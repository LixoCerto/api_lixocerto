import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { QueryTypes, Sequelize } from 'sequelize';

export interface RespostaSaude {
  statusServico: 'saudavel' | 'degradado';
  dataVerificacao: string;
  statusBanco: 'disponivel' | 'indisponivel' | 'nao_configurado';
  statusRedis: 'disponivel' | 'indisponivel' | 'nao_configurado';
  versaoApi: string;
}

@Injectable()
export class ServicoSaude {
  constructor(
    @Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null,
    @Inject('CONEXAO_REDIS') private readonly redis: Redis | null,
  ) {}

  async verificar(): Promise<RespostaSaude> {
    const [statusBanco, statusRedis] = await Promise.all([
      this.verificarBanco(),
      this.verificarRedis(),
    ]);
    return {
      statusServico: [statusBanco, statusRedis].every(status => status === 'disponivel' || status === 'nao_configurado') ? 'saudavel' : 'degradado',
      dataVerificacao: new Date().toISOString(),
      statusBanco,
      statusRedis,
      versaoApi: process.env.VERSAO_API ?? '0.1.0',
    };
  }

  private async verificarBanco(): Promise<RespostaSaude['statusBanco']> {
    if (!this.banco) return 'nao_configurado';
    try {
      await this.banco.query('SELECT 1 AS saudavel', { type: QueryTypes.SELECT });
      return 'disponivel';
    } catch {
      return 'indisponivel';
    }
  }

  private async verificarRedis(): Promise<RespostaSaude['statusRedis']> {
    if (!this.redis) return 'nao_configurado';
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      if (this.redis.status !== 'ready') return 'indisponivel';
      return (await this.redis.ping()) === 'PONG' ? 'disponivel' : 'indisponivel';
    } catch {
      return 'indisponivel';
    }
  }
}
