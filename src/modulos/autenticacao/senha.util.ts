import { randomBytes, scrypt as scryptCallback, ScryptOptions, timingSafeEqual } from 'node:crypto';

const TAMANHO_SALT = 16;
const TAMANHO_HASH = 64;
const CUSTO_SCRYPT = 16384;
const BLOCO_SCRYPT = 8;
const PARALELISMO_SCRYPT = 1;

function derivarSenha(senha: string, salt: Buffer, tamanho: number, opcoes: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(senha, salt, tamanho, opcoes, (erro, resultado) => {
      if (erro) reject(erro);
      else resolve(resultado as Buffer);
    });
  });
}

export async function criarHashSenha(senha: string): Promise<string> {
  const salt = randomBytes(TAMANHO_SALT);
  const derivacao = await derivarSenha(senha, salt, TAMANHO_HASH, {
    N: CUSTO_SCRYPT,
    r: BLOCO_SCRYPT,
    p: PARALELISMO_SCRYPT,
  });
  return `scrypt$${CUSTO_SCRYPT}$${BLOCO_SCRYPT}$${PARALELISMO_SCRYPT}$${salt.toString('base64url')}$${derivacao.toString('base64url')}`;
}

export async function verificarSenha(senha: string, formato: string): Promise<boolean> {
  const partes = formato.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, custoTexto, blocoTexto, paralelismoTexto, saltTexto, hashTexto] = partes;
  const custo = Number(custoTexto);
  const bloco = Number(blocoTexto);
  const paralelismo = Number(paralelismoTexto);
  if (![custo, bloco, paralelismo].every(Number.isSafeInteger) || !saltTexto || !hashTexto) return false;

  try {
    const salt = Buffer.from(saltTexto, 'base64url');
    const hashEsperado = Buffer.from(hashTexto, 'base64url');
    const derivacao = await derivarSenha(senha, salt, hashEsperado.length, {
      N: custo,
      r: bloco,
      p: paralelismo,
    });
    return derivacao.length === hashEsperado.length && timingSafeEqual(derivacao, hashEsperado);
  } catch {
    return false;
  }
}

export function senhaValida(senha: string): boolean {
  return senha.length >= 12 && /[A-Za-z]/.test(senha) && /\d/.test(senha);
}
