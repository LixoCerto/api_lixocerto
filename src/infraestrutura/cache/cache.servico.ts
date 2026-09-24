import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class ServicoCache {
  constructor(@Inject('CONEXAO_REDIS') private readonly redis: Redis | null) {}

  private async conectar(): Promise<boolean> {
    if (!this.redis) return false;
    if (this.redis.status === 'wait') await this.redis.connect();
    return this.redis.status === 'ready';
  }

  async obter(chave: string): Promise<string | null> {
    if (!(await this.conectar())) return null;
    return this.redis!.get(chave);
  }

  async definir(chave: string, valor: string, ttlSegundos = 300): Promise<boolean> {
    if (!Number.isInteger(ttlSegundos) || ttlSegundos < 1 || ttlSegundos > 86_400) {
      throw new Error('TTL do cache deve estar entre 1 e 86400 segundos');
    }
    if (!(await this.conectar())) return false;
    await this.redis!.set(chave, valor, 'EX', ttlSegundos);
    return true;
  }

  async remover(chave: string): Promise<boolean> {
    if (!(await this.conectar())) return false;
    return (await this.redis!.del(chave)) > 0;
  }

  async verificarConexao(): Promise<boolean> {
    if (!(await this.conectar())) return false;
    return (await this.redis!.ping()) === 'PONG';
  }
}
