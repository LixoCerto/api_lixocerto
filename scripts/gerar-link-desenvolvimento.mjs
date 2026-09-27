/**
 * Gera um link de confirmação de e-mail ou de redefinição de senha para teste
 * manual em desenvolvimento — sem depender do envio real pelo Resend.
 *
 * Uso:
 *   node scripts/gerar-link-desenvolvimento.mjs <email> [verificacao|redefinicao]
 *
 * Por que existe: com PROVEDOR_EMAIL=log o envio real fica desativado e o log
 * mostra apenas metadados (nunca o token), então não há como abrir o link no
 * navegador para testar as telas. Este script grava um token de uso único
 * exatamente como a API faria e imprime a URL correspondente.
 *
 * Somente para desenvolvimento: recusa execução quando AMBIENTE_EXECUCAO=producao.
 * O token gerado é um token real — expira, é consumido no uso e pode ser
 * invalidado por uma nova solicitação feita pela própria aplicação.
 */
import { createHash, randomBytes } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(raiz, '.env') });

const EXPIRACAO_PADRAO_MINUTOS = { verificacao: 24 * 60, redefinicao: 60 };
const CAMINHO_PADRAO = { verificacao: 'confirmar-email', redefinicao: 'redefinir-senha' };

function encerrar(mensagem) {
  console.error(`\n[falha] ${mensagem}\n`);
  process.exit(1);
}

function hashToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

const [emailArgumento, tipoArgumento = 'verificacao'] = process.argv.slice(2);

if (!emailArgumento || emailArgumento.startsWith('-')) {
  console.error('Uso: node scripts/gerar-link-desenvolvimento.mjs <email> [verificacao|redefinicao]');
  process.exit(2);
}

const tipo = tipoArgumento === 'redefinicao' ? 'redefinicao_senha' : 'verificacao_email';
const chavePadrao = tipoArgumento === 'redefinicao' ? 'redefinicao' : 'verificacao';

if (process.env.AMBIENTE_EXECUCAO === 'producao') {
  encerrar('Este utilitário é exclusivo de desenvolvimento e não roda com AMBIENTE_EXECUCAO=producao.');
}
if (!process.env.URL_BANCO_DADOS) {
  encerrar('URL_BANCO_DADOS não configurada. Verifique api_lixocerto/.env.');
}

const email = emailArgumento.trim().toLowerCase();
const banco = new pg.Client({ connectionString: process.env.URL_BANCO_DADOS });

try {
  await banco.connect();

  const usuario = await banco.query(
    'SELECT lcr_usr_id_usuario, lcr_usr_nome, lcr_usr_status_usuario FROM lcr_usuarios WHERE lcr_usr_email = $1',
    [email],
  );
  if (usuario.rowCount === 0) encerrar(`Nenhuma conta encontrada para ${email}.`);
  if (usuario.rows[0].lcr_usr_status_usuario !== 'ativo') {
    encerrar(`A conta ${email} está com status "${usuario.rows[0].lcr_usr_status_usuario}".`);
  }

  const idUsuario = usuario.rows[0].lcr_usr_id_usuario;
  const token = randomBytes(32).toString('base64url');
  const expiraEm = new Date(Date.now() + EXPIRACAO_PADRAO_MINUTOS[chavePadrao] * 60_000);

  // Mesmo comportamento do serviço: a nova solicitação substitui as anteriores.
  await banco.query(
    `UPDATE lcr_tokens_autenticacao SET lcr_tka_data_consumo = CURRENT_TIMESTAMP
     WHERE lcr_tka_id_usuario = $1 AND lcr_tka_tipo_token = $2 AND lcr_tka_data_consumo IS NULL`,
    [idUsuario, tipo],
  );
  await banco.query(
    `INSERT INTO lcr_tokens_autenticacao (
       lcr_tka_id_usuario, lcr_tka_tipo_token, lcr_tka_hash_token, lcr_tka_data_expiracao
     ) VALUES ($1, $2, $3, $4)`,
    [idUsuario, tipo, hashToken(token), expiraEm],
  );

  const base = (process.env.URL_PUBLICA_FRONTEND?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
  const url = `${base}/${CAMINHO_PADRAO[chavePadrao]}?token=${encodeURIComponent(token)}`;

  console.log('\nLink de desenvolvimento gerado');
  console.log(`  conta      : ${usuario.rows[0].lcr_usr_nome} <${email}>`);
  console.log(`  tipo       : ${tipo}`);
  console.log(`  expira em  : ${EXPIRACAO_PADRAO_MINUTOS[chavePadrao]} minuto(s)`);
  console.log(`\n${url}\n`);
  console.log('Abra a URL no navegador. O token é de uso único e deixa de valer após o uso.\n');
} catch (erro) {
  encerrar(erro.message);
} finally {
  await banco.end().catch(() => {});
}
