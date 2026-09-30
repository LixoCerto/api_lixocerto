import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { QueryTypes, Sequelize } from 'sequelize';

const require = createRequire(import.meta.url);
const { production: configuracaoBanco } = require('../configuracao_sequelize.cjs');
const diretorioLegado = process.env.LCR_EVIDENCIAS_MIGRACAO_ORIGEM || '/legacy';
const endpoint = process.env.LCR_EVIDENCIAS_S3_ENDPOINT;
const bucket = process.env.LCR_EVIDENCIAS_S3_BUCKET || 'lcr-evidencias-descartes';
const accessKeyId = process.env.LCR_EVIDENCIAS_S3_ACCESS_KEY;
const secretAccessKey = process.env.LCR_EVIDENCIAS_S3_SECRET_KEY;
const regiao = process.env.LCR_EVIDENCIAS_S3_REGION || 'us-east-1';
const somenteValidar = process.argv.includes('--dry-run');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
  throw new Error('Configuração S3 incompleta; confira os nomes das variáveis locais, sem compartilhá-las.');
}

const banco = new Sequelize(configuracaoBanco);
const s3 = new S3Client({
  endpoint,
  region: regiao,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function erroObjetoAusente(erro) {
  const falha = erro ?? {};
  return falha.$metadata?.httpStatusCode === 404 || ['NoSuchKey', 'NotFound'].includes(falha.name);
}

async function lerObjetoRemoto(chave) {
  const resposta = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: `${chave}.webp` }));
  if (!resposta.Body) throw new Error(`O objeto remoto ${chave} não retornou conteúdo.`);
  return Buffer.from(await resposta.Body.transformToByteArray());
}

async function executar() {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  await banco.authenticate();
  const referencias = await banco.query(`
    SELECT DISTINCT
      lcr_rde_chave_foto AS "chaveFoto",
      lcr_rde_hash_foto_sha256 AS "hashFoto",
      lcr_rde_tamanho_foto_bytes AS "tamanhoFoto"
    FROM lcr_registros_descartes
    WHERE lcr_rde_chave_foto IS NOT NULL
      AND lcr_rde_foto_removida_em IS NULL
      AND (lcr_rde_foto_expira_em IS NULL OR lcr_rde_foto_expira_em > CURRENT_TIMESTAMP)
    ORDER BY "chaveFoto"
  `, { type: QueryTypes.SELECT });

  const nomes = await readdir(diretorioLegado, { withFileTypes: true });
  const arquivos = new Set();
  for (const entrada of nomes) {
    if (!entrada.isFile() || !entrada.name.toLowerCase().endsWith('.webp')) {
      throw new Error('O volume legado contém um item inesperado; interrompido sem alterar a origem.');
    }
    const nome = entrada.name.slice(0, -5);
    if (!uuid.test(nome)) throw new Error('O volume legado contém uma chave inesperada; interrompido sem alterar a origem.');
    arquivos.add(nome.toLowerCase());
  }

  let copiados = 0;
  let jaVerificados = 0;
  let bytesVerificados = 0;
  const chavesReferenciadas = new Set();
  const metadadosPorChave = new Map();

  for (const referencia of referencias) {
    const chaveOriginal = String(referencia.chaveFoto ?? '');
    if (!uuid.test(chaveOriginal)) throw new Error('O banco contém uma chave de evidência inválida; interrompido sem alterar a origem.');
    const chave = chaveOriginal.toLowerCase();
    const hashDeclarado = referencia.hashFoto ? String(referencia.hashFoto).toLowerCase() : null;
    const tamanhoDeclarado = referencia.tamanhoFoto === null || referencia.tamanhoFoto === undefined
      ? null
      : Number(referencia.tamanhoFoto);
    const anterior = metadadosPorChave.get(chave);
    if (anterior) {
      if (anterior.hash && hashDeclarado && anterior.hash !== hashDeclarado) {
        throw new Error(`O banco possui hashes conflitantes para uma evidência (${chave}); a origem foi preservada.`);
      }
      if (anterior.tamanho !== null && tamanhoDeclarado !== null && anterior.tamanho !== tamanhoDeclarado) {
        throw new Error(`O banco possui tamanhos conflitantes para uma evidência (${chave}); a origem foi preservada.`);
      }
      anterior.hash ??= hashDeclarado;
      anterior.tamanho ??= tamanhoDeclarado;
      continue;
    }
    metadadosPorChave.set(chave, { hash: hashDeclarado, tamanho: tamanhoDeclarado });
    chavesReferenciadas.add(chave);
  }

  for (const chave of chavesReferenciadas) {
    const referencia = metadadosPorChave.get(chave);
    if (!arquivos.has(chave)) throw new Error(`Falta arquivo local para uma evidência ainda válida (${chave}); a API não deve ser apontada ao MinIO.`);
    const local = await readFile(join(diretorioLegado, `${chave}.webp`));
    const hashLocal = sha256(local);
    if (referencia.hash && referencia.hash !== hashLocal) {
      throw new Error(`O SHA-256 local diverge do metadado do banco (${chave}); a origem foi preservada.`);
    }
    if (referencia.tamanho !== null && referencia.tamanho !== local.length) {
      throw new Error(`O tamanho local diverge do metadado do banco (${chave}); a origem foi preservada.`);
    }
    bytesVerificados += local.length;

    if (somenteValidar) continue;

    let remoto;
    try {
      remoto = await lerObjetoRemoto(chave);
    } catch (erro) {
      if (!erroObjetoAusente(erro)) throw erro;
    }

    if (remoto) {
      if (sha256(remoto) !== hashLocal) throw new Error(`Já existe um objeto MinIO com conteúdo divergente (${chave}); nada foi sobrescrito.`);
      jaVerificados += 1;
      continue;
    }

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: `${chave}.webp`,
      Body: local,
      ContentType: 'image/webp',
      Metadata: { sha256: hashLocal },
    }));
    const gravado = await lerObjetoRemoto(chave);
    if (sha256(gravado) !== hashLocal) throw new Error(`A verificação após upload falhou (${chave}); o volume original continua intacto.`);
    copiados += 1;
  }

  console.log(JSON.stringify({
    resultado: somenteValidar ? 'validacao_local_concluida' : 'migracao_verificada',
    referenciasAtivasNoBanco: chavesReferenciadas.size,
    arquivosNoVolumeLegado: arquivos.size,
    objetosCopiadosAgora: copiados,
    objetosMinioJaVerificados: jaVerificados,
    bytesLocaisVerificados: bytesVerificados,
    volumeLegadoAlterado: false,
  }, null, 2));
}

try {
  await executar();
} catch (erro) {
  console.error(`Migração interrompida; o volume legado não foi alterado. Tipo do erro: ${erro instanceof Error ? erro.name : 'erro'}.`);
  process.exitCode = 1;
} finally {
  s3.destroy();
  await banco.close().catch(() => undefined);
}
