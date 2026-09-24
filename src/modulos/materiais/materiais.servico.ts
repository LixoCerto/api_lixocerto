import { Injectable } from '@nestjs/common';
import { FiltroMateriais, RepositorioMateriais } from './materiais.repositorio.js';

@Injectable()
export class ServicoMateriais {
  constructor(private readonly repositorio: RepositorioMateriais) {}

  listar(filtro: FiltroMateriais) {
    return this.repositorio.listar(filtro);
  }
}
