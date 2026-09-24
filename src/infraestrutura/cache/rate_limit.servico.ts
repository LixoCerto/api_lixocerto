import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface ResultadoRateLimit {
  permitido: boolean;
  restante: number;
  disponivel: boolean;
}

@Injectable()
export class ServicoRateLimit {
  constructor(@Inject('CONEXAO_REDIS') private readonly redis: Redis | null) {}

  async permitir(chave: string, limite: number, janelaSegundos: number): Promise<ResultadoRateLimit> {
    if (!Number.isInteger(limite) || limite < 1 || !Number.isInteger(janelaSegundos) || janelaSegundos < 1) {
      throw new Error('Limite e janela do rate limit devem ser inteiros positivos');
    }
    if (!this.redis) return { permitido: false, restante: 0, disponivel: false };
    if (this.redis.status === 'wait') await this.redis.connect();
    if (this.redis.status !== 'ready') return { permitido: false, restante: 0, disponivel: false };

    const contagem = Number(await this.redis.eval(
      `local contagem = redis.call('INCR', KEYS[1])
       if contagem == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
       return contagem`,
      1,
      chave,
      janelaSegundos,
    ));
    return {
      permitido: contagem <= limite,
      restante: Math.max(0, limite - contagem),
      disponivel: true,
    };
  }
}
