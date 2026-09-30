import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { S3Client } from '@aws-sdk/client-s3';
import { ArmazenamentoEvidenciasDescartes } from '../../src/modulos/pontos_coleta/armazenamento_evidencias_descartes.servico.js';

describe('ArmazenamentoEvidenciasDescartes — MinIO/S3', () => {
  const variaveisOriginais = new Map<string, string | undefined>();
  const nomes = [
    'LCR_EVIDENCIAS_STORAGE',
    'LCR_EVIDENCIAS_S3_ENDPOINT',
    'LCR_EVIDENCIAS_S3_BUCKET',
    'LCR_EVIDENCIAS_S3_REGION',
    'LCR_EVIDENCIAS_S3_ACCESS_KEY',
    'LCR_EVIDENCIAS_S3_SECRET_KEY',
  ];
  const objetos = new Map<string, Buffer>();
  let enviar: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    enviar?.mockRestore();
    objetos.clear();
    for (const nome of nomes) {
      const valor = variaveisOriginais.get(nome);
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
    variaveisOriginais.clear();
  });

  it('armazena WebP no bucket privado, lê o mesmo conteúdo e remove a chave', async () => {
    for (const nome of nomes) variaveisOriginais.set(nome, process.env[nome]);
    process.env.LCR_EVIDENCIAS_STORAGE = 's3';
    process.env.LCR_EVIDENCIAS_S3_ENDPOINT = 'http://minio:9000';
    process.env.LCR_EVIDENCIAS_S3_BUCKET = 'lcr-evidencias-descartes';
    process.env.LCR_EVIDENCIAS_S3_REGION = 'us-east-1';
    process.env.LCR_EVIDENCIAS_S3_ACCESS_KEY = 'lcrapp';
    process.env.LCR_EVIDENCIAS_S3_SECRET_KEY = 'segredo-de-teste';

    enviar = vi.spyOn(S3Client.prototype, 'send') as typeof enviar;
    (enviar as unknown as { mockImplementation(fn: (command: any) => Promise<any>): unknown }).mockImplementation(async (command: any) => {
      const chave = String(command.input.Key);
      if (command.constructor.name === 'PutObjectCommand') {
        objetos.set(chave, Buffer.from(command.input.Body));
        return {};
      }
      if (command.constructor.name === 'GetObjectCommand') {
        const conteudo = objetos.get(chave);
        if (!conteudo) {
          const erro = Object.assign(new Error('not found'), { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } });
          throw erro;
        }
        return { Body: { transformToByteArray: async () => new Uint8Array(conteudo) } };
      }
      if (command.constructor.name === 'DeleteObjectCommand') {
        objetos.delete(chave);
        return {};
      }
      throw new Error(`Comando S3 inesperado: ${command.constructor.name}`);
    });

    const servico = new ArmazenamentoEvidenciasDescartes();
    const entrada = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#f0f0f0' } }).png().toBuffer();

    const armazenada = await servico.armazenarImagem(entrada);
    expect(armazenada.chave).toMatch(/^[0-9a-f-]{36}$/i);
    expect(armazenada.hashSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(armazenada.tamanhoBytes).toBeGreaterThan(0);
    expect(objetos.has(`${armazenada.chave}.webp`)).toBe(true);
    await expect(servico.lerImagem(armazenada.chave)).resolves.toEqual(objetos.get(`${armazenada.chave}.webp`));

    await servico.removerImagem(armazenada.chave);
    await expect(servico.lerImagem(armazenada.chave)).resolves.toBeNull();
    servico.onModuleDestroy();
  });
});
