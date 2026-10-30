import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { ServicoGamificacao } from '../gamificacao/gamificacao.servico.js';
import { ServicoDesafios } from '../desafios/desafios.servico.js';
import { EvidenciaArmazenada, ArmazenamentoEvidenciasDescartes } from './armazenamento_evidencias_descartes.servico.js';
import {
  EvidenciaDescartarInput,
  RegistroDescarte,
  RepositorioDescartes,
  ResultadoCheckin,
  StatusRegistroDescarte,
} from './descartes.repositorio.js';

const MAX_PRECISAO_METROS = 10;
const MAX_CATEGORIAS_POR_CHECKIN = 5;
const MAX_BYTES_LOTE = 3 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ServicoDescartes implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServicoDescartes.name);
  private timerExpurgo?: NodeJS.Timeout;

  constructor(
    private readonly repositorio: RepositorioDescartes,
    private readonly gamificacao: ServicoGamificacao,
    private readonly desafios: ServicoDesafios,
    private readonly armazenamento: ArmazenamentoEvidenciasDescartes,
  ) {}

  onModuleInit() {
    void this.executarExpurgo();
    this.timerExpurgo = setInterval(() => void this.executarExpurgo(), 10 * 60 * 1000);
    this.timerExpurgo.unref?.();
  }

  onModuleDestroy() {
    if (this.timerExpurgo) clearInterval(this.timerExpurgo);
  }

  async iniciarCheckin(idUsuario: string, dados: {
    idPontoColeta: string;
    latitude: number;
    longitude: number;
    precisaoMetros: number;
  }): Promise<ResultadoCheckin | null> {
    const idPontoColeta = dados.idPontoColeta?.trim();
    if (!UUID.test(idPontoColeta ?? '')) throw new BadRequestException('Selecione um ponto de coleta válido.');
    if (!Number.isFinite(dados.latitude) || dados.latitude < -90 || dados.latitude > 90
      || !Number.isFinite(dados.longitude) || dados.longitude < -180 || dados.longitude > 180) {
      throw new BadRequestException('A localização retornada pelo navegador é inválida. Tente obter a localização novamente.');
    }
    if (!Number.isFinite(dados.precisaoMetros) || dados.precisaoMetros <= 0 || dados.precisaoMetros > MAX_PRECISAO_METROS) {
      throw new BadRequestException('A precisão do GPS precisa ser de até 10 m. Ative a localização de alta precisão e tente novamente.');
    }

    const resultado = await this.repositorio.iniciarCheckin({ ...dados, idUsuario, idPontoColeta });
    if (resultado && !resultado.operacaoAceita) {
      if (resultado.motivo === 'fora_raio') {
        throw new BadRequestException(`Check-in não aceito: você está a ${Math.ceil(resultado.distanciaMetros ?? 0)} m do ponto; o limite é 5 m. Aproxime-se até ficar a 5 m ou menos e tente novamente.`);
      }
      throw new BadRequestException('Este ponto não está verificado ou não possui coordenadas válidas para check-in.');
    }
    return resultado;
  }

  async concluir(idUsuario: string, idCheckin: string, itensInformados: Array<{
    categoria: string;
    relato: string;
    foto: Uint8Array;
  }>): Promise<RegistroDescarte[] | null> {
    if (!UUID.test(idCheckin ?? '')) throw new BadRequestException('O check-in informado é inválido.');
    if (!Array.isArray(itensInformados) || itensInformados.length === 0 || itensInformados.length > MAX_CATEGORIAS_POR_CHECKIN) {
      throw new BadRequestException('Selecione de 1 a 5 categorias e envie uma foto para cada uma.');
    }

    const categorias = new Set<string>();
    let bytesRecebidos = 0;
    for (const item of itensInformados) {
      item.categoria = (item.categoria ?? '').trim();
      item.relato = (item.relato ?? '').trim();
      if (!item.categoria || item.categoria.length > 80) throw new BadRequestException('Cada categoria precisa ser válida.');
      if (item.relato.length > 500) throw new BadRequestException('Cada relato deve ter até 500 caracteres.');
      const chaveCategoria = normalizar(item.categoria);
      if (categorias.has(chaveCategoria)) throw new BadRequestException('Escolha cada categoria somente uma vez.');
      categorias.add(chaveCategoria);
      if (!(item.foto instanceof Uint8Array) || item.foto.byteLength === 0) throw new BadRequestException(`Envie uma foto para a categoria ${item.categoria}.`);
      bytesRecebidos += item.foto.byteLength;
    }
    if (bytesRecebidos > MAX_BYTES_LOTE) throw new BadRequestException('As fotos juntas devem ter no máximo 3 MiB. Reduza o tamanho e tente novamente.');

    const imagens: EvidenciaArmazenada[] = [];
    try {
      const registrosComFotos: EvidenciaDescartarInput[] = [];
      for (const item of itensInformados) {
        const foto = await this.armazenamento.armazenarImagem(item.foto);
        imagens.push(foto);
        registrosComFotos.push({
          categoria: item.categoria,
          relato: item.relato,
          chaveFoto: foto.chave,
          hashFotoSha256: foto.hashSha256,
          tamanhoFotoBytes: foto.tamanhoBytes,
        });
      }
      const registros = await this.repositorio.concluir({ idUsuario, idCheckin, itens: registrosComFotos });
      if (!registros) {
        await this.removerImagens(imagens);
        return null;
      }
      return registros;
    } catch (erro) {
      await this.removerImagens(imagens);
      throw erro;
    }
  }

  async obterEvidencia(idRegistro: string, idUsuario: string, podeRevisar: boolean): Promise<Buffer | null> {
    const chave = await this.repositorio.obterChaveEvidencia(idRegistro, idUsuario, podeRevisar);
    if (!chave) return null;
    try {
      return await this.armazenamento.lerImagem(chave);
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw erro;
    }
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

  private async executarExpurgo() {
    try {
      const resultado = await this.repositorio.expurgarEvidencias(chave => this.armazenamento.removerImagem(chave));
      if (resultado.fotos || resultado.coordenadas || resultado.checkinsAbandonados) {
        this.logger.log(`Retenção de descartes: ${resultado.fotos} fotos e ${resultado.coordenadas} coordenadas expurgadas; ${resultado.checkinsAbandonados} check-ins não concluídos removidos.`);
      }
    } catch (erro) {
      this.logger.warn(`Expurgo agendado de evidências não executado: ${erro instanceof Error ? erro.name : 'erro'}`);
    }
  }

  private async removerImagens(imagens: EvidenciaArmazenada[]) {
    await Promise.all(imagens.map(imagem => this.armazenamento.removerImagem(imagem.chave).catch(erro => {
      this.logger.warn(`Não foi possível limpar uma foto temporária após falha de gravação: ${erro instanceof Error ? erro.name : 'erro'}`);
    })));
  }
}

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}
