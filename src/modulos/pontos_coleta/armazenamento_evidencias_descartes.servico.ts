import { BadRequestException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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

type ModoArmazenamento = 'filesystem' | 's3';

@Injectable()
export class ArmazenamentoEvidenciasDescartes implements OnModuleDestroy {
  private readonly diretorio = resolve(
    process.env.LCR_ARMAZENAMENTO_DESCARTES || join(process.cwd(), '.dados', 'evidencias-descartes'),
  );
  private readonly modo: ModoArmazenamento;
  private readonly bucket: string;
  private readonly clienteS3: S3Client | null;

  constructor() {
    const modoConfigurado = (process.env.LCR_EVIDENCIAS_STORAGE || 'filesystem').trim().toLowerCase();
    if (modoConfigurado !== 'filesystem' && modoConfigurado !== 's3') {
      throw new Error('LCR_EVIDENCIAS_STORAGE precisa ser filesystem ou s3.');
    }
    this.modo = modoConfigurado;
    this.bucket = process.env.LCR_EVIDENCIAS_S3_BUCKET?.trim() || 'lcr-evidencias-descartes';

    if (this.modo === 'filesystem') {
      this.clienteS3 = null;
      return;
    }

    const endpoint = process.env.LCR_EVIDENCIAS_S3_ENDPOINT?.trim();
    const accessKeyId = process.env.LCR_EVIDENCIAS_S3_ACCESS_KEY?.trim();
    const secretAccessKey = process.env.LCR_EVIDENCIAS_S3_SECRET_KEY;
    if (!endpoint || !accessKeyId || !secretAccessKey || !this.bucket) {
      throw new Error('Configuração S3 incompleta para armazenamento de evidências.');
    }

    this.clienteS3 = new S3Client({
      endpoint,
      region: process.env.LCR_EVIDENCIAS_S3_REGION?.trim() || 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  onModuleDestroy() {
    this.clienteS3?.destroy();
  }

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
    const hashSha256 = createHash('sha256').update(fotoWebp).digest('hex');
    if (this.clienteS3) {
      await this.clienteS3.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.chaveObjeto(chave),
        Body: fotoWebp,
        ContentType: 'image/webp',
        Metadata: { sha256: hashSha256 },
      }));
    } else {
      const caminho = this.caminhoSeguro(chave);
      await mkdir(this.diretorio, { recursive: true, mode: 0o700 });
      await chmod(this.diretorio, 0o700);
      await writeFile(caminho, fotoWebp, { flag: 'wx', mode: 0o600 });
    }

    return { chave, hashSha256, tamanhoBytes: fotoWebp.length };
  }

  async lerImagem(chave: string): Promise<Buffer | null> {
    if (!this.clienteS3) {
      try {
        return await readFile(this.caminhoSeguro(chave));
      } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw erro;
      }
    }

    try {
      const objeto = await this.clienteS3.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.chaveObjeto(chave) }));
      if (!objeto.Body) return null;
      return Buffer.from(await objeto.Body.transformToByteArray());
    } catch (erro) {
      if (objetoNaoEncontrado(erro)) return null;
      throw erro;
    }
  }

  async removerImagem(chave: string): Promise<void> {
    if (this.clienteS3) {
      await this.clienteS3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.chaveObjeto(chave) }));
      return;
    }

    try {
      await unlink(this.caminhoSeguro(chave));
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro;
    }
  }

  private chaveObjeto(chave: string): string {
    if (!PADRAO_UUID.test(chave)) throw new BadRequestException('Identificador de evidência inválido.');
    return `${chave.toLowerCase()}.webp`;
  }

  private caminhoSeguro(chave: string): string {
    const nome = this.chaveObjeto(chave);
    const caminho = resolve(this.diretorio, nome);
    const relativo = relative(this.diretorio, caminho);
    if (!relativo || relativo.startsWith(`..${sep}`) || relativo.startsWith('..') || isAbsolute(relativo)) {
      throw new BadRequestException('Caminho de evidência inválido.');
    }
    return join(this.diretorio, nome);
  }
}

function objetoNaoEncontrado(erro: unknown): boolean {
  const falha = erro as { name?: string; $metadata?: { httpStatusCode?: number } };
  return falha.$metadata?.httpStatusCode === 404 || falha.name === 'NoSuchKey' || falha.name === 'NotFound';
}
