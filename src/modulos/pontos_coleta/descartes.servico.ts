import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { ServicoGamificacao } from '../gamificacao/gamificacao.servico.js';
import { ServicoDesafios } from '../desafios/desafios.servico.js';
import { RegistroDescarte, RepositorioDescartes, StatusRegistroDescarte } from './descartes.repositorio.js';

@Injectable()
export class ServicoDescartes {
  private readonly logger = new Logger(ServicoDescartes.name);

  constructor(
    private readonly repositorio: RepositorioDescartes,
    private readonly gamificacao: ServicoGamificacao,
    private readonly desafios: ServicoDesafios,
  ) {}

  async registrar(idUsuario: string, dados: { idPontoColeta: string; categoria: string; relato: string }) {
    const idPontoColeta = dados.idPontoColeta?.trim();
    const categoria = dados.categoria?.trim();
    const relato = (dados.relato ?? '').trim();
    if (!idPontoColeta || !categoria || categoria.length > 80) throw new BadRequestException('Selecione um ponto de coleta e uma categoria válida');
    if (relato.length > 500) throw new BadRequestException('O relato deve ter até 500 caracteres');
    return this.repositorio.registrar({ idUsuario, idPontoColeta, categoria, relato });
  }

  listarMeus(idUsuario: string) {
    return this.repositorio.listarMeus(idUsuario);
  }

  listarGestao(status: StatusRegistroDescarte | 'todos' = 'pendente') {
    return this.repositorio.listarGestao(status);
  }

  revisar(idUsuarioRevisor: string, idRegistro: string, status: string) {
    if (status !== 'aprovado' && status !== 'rejeitado') throw new BadRequestException('Resultado de revisão inválido');
    return this.repositorio.revisar(
      { idRegistro: idRegistro.trim(), idRevisor: idUsuarioRevisor, status: status as 'aprovado' | 'rejeitado' },
      (registro: RegistroDescarte, transaction: Transaction) => this.gamificacao.concederPontos(
        registro.idUsuario!,
        20,
        'descarte_validado',
        registro.idRegistro,
        registro.categoriaMaterial,
        transaction,
      ),
    ).then(async registro => {
      if (registro?.status === 'aprovado' && registro.idUsuario) {
        try {
          await this.desafios.processarProgresso(registro.idUsuario);
        } catch (erro) {
          this.logger.warn(`Não foi possível atualizar metas após descarte aprovado: ${erro instanceof Error ? erro.name : 'erro'}`);
        }
      }
      return registro;
    });
  }
}
