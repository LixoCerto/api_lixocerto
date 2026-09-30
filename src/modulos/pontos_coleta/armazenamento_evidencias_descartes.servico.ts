import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';

export type EvidenciaArmazenada = {
  chave: string;
  hashSha256: string;
  tamanhoBytes: number;
};

const MAX_FOTO_ENTRADA_BYTES = 2 * 1024 * 1024;
const MAX_FOTO_PROCESSADA_BYTES = 3 * 1024 * 1024;
const FORMATOS_ACEITOS = new Set(['jpeg', 'png', 'webp']);
const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ArmazenamentoEvidenciasDescartes {
  private readonly diretorio = resolve(
    process.env.LCR_ARMAZENAMENTO_DESCARTES || join(process.cwd(), '.dados', 'evidencias-descartes'),
  );

  async armazenarImagem(entrada: Uint8Array): Promise<EvidenciaArmazenada> {
    const bytesEntrada = Buffer.from(entrada);
    if (bytesEntrada.length === 0 || bytesEntrada.length > MAX_FOTO_ENTRADA_BYTES) {
      throw new BadRequestException('Cada foto deve ter entre 1 byte e 2 MiB antes do processamento.');
    }

    let fotoWebp: Buffer;
    try {
      const imagem = sharp(bytesEntrada, { failOn: 'error', limitInputPixels: 20_000_000, animated: false });
      const metadados = await imagem.metadata();
      if (!metadados.format || !FORMATOS_ACEITOS.has(metadados.format) || !metadados.width || !metadados.height || (metadados.pages ?? 1) > 1) {
        throw new BadRequestException('Envie uma foto estática JPEG, PNG ou WebP válida.');
      }
      fotoWebp = await imagem
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84, effort: 4 })
        .toBuffer();
    } catch (erro) {
      if (erro instanceof BadRequestException) throw erro;
      throw new BadRequestException('A foto não pôde ser validada. Selecione outra imagem JPEG, PNG ou WebP.');
    }

    if (fotoWebp.length > MAX_FOTO_PROCESSADA_BYTES) {
      throw new BadRequestException('A foto processada excedeu 3 MiB. Reduza a imagem e tente novamente.');
    }

    const chave = randomUUID();
    const caminho = this.caminhoSeguro(chave);
    await mkdir(this.diretorio, { recursive: true, mode: 0o700 });
    await chmod(this.diretorio, 0o700);
    await writeFile(caminho, fotoWebp, { flag: 'wx', mode: 0o600 });
    return {
      chave,
      hashSha256: createHash('sha256').update(fotoWebp).digest('hex'),
      tamanhoBytes: fotoWebp.length,
    };
  }

  async lerImagem(chave: string): Promise<Buffer> {
    return readFile(this.caminhoSeguro(chave));
  }

  async removerImagem(chave: string): Promise<void> {
    try {
      await unlink(this.caminhoSeguro(chave));
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro;
    }
  }

  private caminhoSeguro(chave: string): string {
    if (!PADRAO_UUID.test(chave)) throw new BadRequestException('Identificador de evidência inválido.');
    const caminho = resolve(this.diretorio, `${chave}.webp`);
    const relativo = relative(this.diretorio, caminho);
    if (!relativo || relativo.startsWith(`..${sep}`) || relative(this.diretorio, caminho).startsWith('..') || isAbsolute(relativo)) {
      throw new BadRequestException('Caminho de evidência inválido.');
    }
    return join(this.diretorio, `${chave}.webp`);
  }
}
