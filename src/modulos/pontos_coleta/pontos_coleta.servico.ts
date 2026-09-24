import { Injectable } from '@nestjs/common';
import { FiltroPontosColeta, RepositorioPontosColeta } from './pontos_coleta.repositorio.js';

@Injectable()
export class ServicoPontosColeta {
  constructor(private readonly repositorio: RepositorioPontosColeta) {}

  listar(filtro: FiltroPontosColeta) {
    return this.repositorio.listar(filtro);
  }
}
