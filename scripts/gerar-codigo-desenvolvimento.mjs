/**
 * Gera um código de confirmação de e-mail ou de redefinição de senha para teste
 * manual em desenvolvimento — sem depender do envio real pelo Resend.
 *
 * Uso:
 *   node scripts/gerar-codigo-desenvolvimento.mjs <email> [verificacao|redefinicao]
 *
 * Por que existe: com PROVEDOR_EMAIL=log o envio real fica desativado e o log
 * mostra apenas metadados (nunca o código), então não há como ler o código para
 * testar as telas. Este script grava um código real, exatamente como a API
 * faria, e imprime o valor para digitar no aplicativo.
 *
 * Somente para desenvolvimento: recusa execução quando AMBIENTE_EXECUCAO=producao.
 * O código gerado é real — expira, é consumido no uso e pode ser invalidado por
 * uma nova solicitação feita pela própria aplicação.
 */
import { createHmac, randomInt } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(raiz, ".env") });

/** Mesmo alfabeto do código em produção: sem vogais e sem caracteres ambíguos. */
const ALFABETO_CODIGO = "23456789BCDFGHJKMNPQRSTVWXYZ";
const COMPRIMENTO_CODIGO = 6;
const SEGREDO_DOMINIO = "lcr:codigo-verificacao-email:v1";

const EXPIRACAO_MINUTOS = 15;

function encerrar(mensagem) {
  console.error(`\n[falha] ${mensagem}\n`);
  process.exit(1);
}

function gerarCodigo() {
  let codigo = "";
  for (let posicao = 0; posicao < COMPRIMENTO_CODIGO; posicao += 1) {
    codigo += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  }
  return codigo;
}

/**
 * Reproduz a derivação do serviço: HMAC-SHA256 com subchave derivada do
 * segredo, isolada por domínio e pelo tipo do fluxo.
 */
function hashCodigo(codigo, tipo) {
  const dedicado = process.env.SEGREDO_CODIGO_EMAIL?.trim();
  const base =
    dedicado && dedicado.length >= 32
      ? dedicado
      : process.env.SEGREDO_JWT?.trim();
  if (!base || base.length < 32) {
    encerrar(
      "Defina SEGREDO_CODIGO_EMAIL (ou SEGREDO_JWT) com pelo menos 32 caracteres no .env da API.",
    );
  }
  const chave = createHmac("sha256", SEGREDO_DOMINIO)
    .update(base, "utf8")
    .digest();
  return createHmac("sha256", chave)
    .update(`${tipo}:${codigo}`, "utf8")
    .digest("hex");
}

const [emailArgumento, tipoArgumento = "verificacao"] = process.argv.slice(2);

if (!emailArgumento || emailArgumento.startsWith("-")) {
  console.error(
    "Uso: node scripts/gerar-codigo-desenvolvimento.mjs <email> [verificacao|redefinicao]",
  );
  process.exit(2);
}

const tipo =
  tipoArgumento === "redefinicao" ? "redefinicao_senha" : "verificacao_email";

if (process.env.AMBIENTE_EXECUCAO === "producao") {
  encerrar(
    "Este utilitário é exclusivo de desenvolvimento e não roda com AMBIENTE_EXECUCAO=producao.",
  );
}
if (!process.env.BANCO_DADOS_HOST || !process.env.BANCO_DADOS_NOME) {
  encerrar(
    "BANCO_DADOS_HOST e BANCO_DADOS_NOME não configuradas. Verifique api_lixocerto/.env.",
  );
}

const email = emailArgumento.trim().toLowerCase();
const banco = new pg.Client({
  host: process.env.BANCO_DADOS_HOST,
  port: Number.parseInt(process.env.BANCO_DADOS_PORTA ?? "5432", 10),
  user: process.env.BANCO_DADOS_USUARIO,
  password: process.env.BANCO_DADOS_SENHA,
  database: process.env.BANCO_DADOS_NOME,
});

try {
  await banco.connect();

  const usuario = await banco.query(
    "SELECT lcr_usr_id_usuario, lcr_usr_nome, lcr_usr_status_usuario, lcr_usr_email_verificado_em FROM lcr_usuarios WHERE lcr_usr_email = $1",
    [email],
  );
  if (usuario.rowCount === 0) {
    const existentes = await banco.query(
      `SELECT lcr_usr_email, lcr_usr_status_usuario FROM lcr_usuarios
       ORDER BY lcr_usr_data_criacao DESC LIMIT 10`,
    );
    if (existentes.rowCount === 0) {
      encerrar(
        `Nenhuma conta encontrada para ${email} e o banco não possui usuários cadastrados.\n` +
          "        Crie uma conta pela interface (http://localhost:3000) e tente de novo.",
      );
    }
    const lista = existentes.rows
      .map(
        (linha) =>
          `        - ${linha.lcr_usr_email} (${linha.lcr_usr_status_usuario})`,
      )
      .join("\n");
    encerrar(
      `Nenhuma conta encontrada para ${email}.\n\n        Contas existentes (mais recentes primeiro):\n${lista}`,
    );
  }
  if (usuario.rows[0].lcr_usr_status_usuario !== "ativo") {
    encerrar(
      `A conta ${email} está com status "${usuario.rows[0].lcr_usr_status_usuario}".`,
    );
  }

  const idUsuario = usuario.rows[0].lcr_usr_id_usuario;
  const codigo = gerarCodigo();
  const expiraEm = new Date(Date.now() + EXPIRACAO_MINUTOS * 60_000);

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
    [idUsuario, tipo, hashCodigo(codigo, tipo), expiraEm],
  );

  console.log("\nCódigo de desenvolvimento gerado");
  console.log(`  conta      : ${usuario.rows[0].lcr_usr_nome} <${email}>`);
  console.log(`  tipo       : ${tipo}`);
  console.log(`  expira em  : ${EXPIRACAO_MINUTOS} minuto(s)`);
  console.log(`\n    ${codigo}\n`);
  console.log("Digite este código na tela correspondente do aplicativo.");
  console.log("Ele é de uso único e deixa de valer após o uso.\n");
} catch (erro) {
  encerrar(erro.message);
} finally {
  await banco.end().catch(() => {});
}
