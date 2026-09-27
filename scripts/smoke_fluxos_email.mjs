/**
 * Smoke test real dos fluxos de e-mail contra a API gRPC compilada.
 *
 * Uso:
 *   BANCO_DADOS_HOST=... BANCO_DADOS_NOME=... REDIS_HOST=... PROVEDOR_EMAIL=log pnpm compilar
 *   node scripts/smoke_fluxos_email.mjs
 *
 * O script inicia a API em uma porta isolada, executa o fluxo completo
 * (cadastro → bloqueio de acesso → código → verificação → recuperação →
 * redefinição) e valida o banco. Nenhum e-mail real é enviado com
 * PROVEDOR_EMAIL=log.
 *
 * O código de 6 caracteres não é recuperável a partir do hash persistido, então
 * os caminhos felizes usam um código conhecido gravado diretamente no banco, na
 * mesma forma em que a API grava.
 */
import { spawn } from "node:child_process";
import { createHmac, randomInt, randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as esperar } from "node:timers/promises";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import pg from "pg";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORTA = process.env.PORTA_SMOKE ?? "50999";
const CONFIG_BANCO = {
  host: process.env.BANCO_DADOS_HOST,
  port: Number.parseInt(process.env.BANCO_DADOS_PORTA ?? "5432", 10),
  user: process.env.BANCO_DADOS_USUARIO,
  password: process.env.BANCO_DADOS_SENHA,
  database: process.env.BANCO_DADOS_NOME,
};

const ALFABETO_CODIGO = "23456789BCDFGHJKMNPQRSTVWXYZ";
const COMPRIMENTO_CODIGO = 6;
const SEGREDO_DOMINIO = "lcr:codigo-verificacao-email:v1";
const SEGREDO_CODIGO =
  process.env.SEGREDO_CODIGO_EMAIL ??
  process.env.SEGREDO_JWT ??
  "segredo-jwt-de-teste-com-mais-de-32-caracteres";

if (!CONFIG_BANCO.host || !CONFIG_BANCO.database) {
  console.error("BANCO_DADOS_HOST e BANCO_DADOS_NOME nao configuradas");
  process.exit(1);
}

const resultados = [];
function registrar(nome, aprovado, detalhe = "") {
  resultados.push({ nome, aprovado, detalhe });
  console.log(
    `${aprovado ? "[ok]  " : "[falha]"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`,
  );
}

function gerarCodigo() {
  let codigo = "";
  for (let posicao = 0; posicao < COMPRIMENTO_CODIGO; posicao += 1) {
    codigo += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  }
  return codigo;
}

/** Mesma derivação usada pelo serviço: HMAC com subchave isolada por domínio. */
function hashCodigo(codigo, tipo) {
  const chave = createHmac("sha256", SEGREDO_DOMINIO)
    .update(SEGREDO_CODIGO, "utf8")
    .digest();
  return createHmac("sha256", chave)
    .update(`${tipo}:${codigo}`, "utf8")
    .digest("hex");
}

/**
 * Injeta um código conhecido diretamente no banco, na mesma forma em que a API grava.
 * Isso permite validar o caminho feliz do gRPC sem depender do e-mail real.
 */
async function injetarCodigo(idUsuario, tipo, codigo, minutosValidade) {
  await banco.query(
    `UPDATE lcr_tokens_autenticacao SET lcr_tka_data_consumo = CURRENT_TIMESTAMP
     WHERE lcr_tka_id_usuario = $1 AND lcr_tka_tipo_token = $2 AND lcr_tka_data_consumo IS NULL`,
    [idUsuario, tipo],
  );
  await banco.query(
    `INSERT INTO lcr_tokens_autenticacao (
       lcr_tka_id_usuario, lcr_tka_tipo_token, lcr_tka_hash_token, lcr_tka_data_expiracao
     ) VALUES ($1, $2, $3, $4)`,
    [
      idUsuario,
      tipo,
      hashCodigo(codigo, tipo),
      new Date(Date.now() + minutosValidade * 60_000),
    ],
  );
}

const definicao = protoLoader.loadSync(
  join(raiz, "contratos/lixo_certo/v1/servico_autenticacao.proto"),
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  },
);
const proto = grpc.loadPackageDefinition(definicao).lixo_certo.v1;

const cliente = new proto.ServicoAutenticacao(
  `127.0.0.1:${PORTA}`,
  grpc.credentials.createInsecure(),
);

function chamar(metodo, requisicao, cabecalhos = {}) {
  const metadados = new grpc.Metadata();
  for (const [nome, valor] of Object.entries(cabecalhos))
    metadados.set(nome, valor);
  return new Promise((aceitar, rejeitar) => {
    cliente[metodo](requisicao, metadados, (erro, resposta) =>
      erro ? rejeitar(erro) : aceitar(resposta),
    );
  });
}

const processosFilhos = [];
async function iniciarApi() {
  const processo = spawn("node", ["dist/src/principal.js"], {
    cwd: raiz,
    env: {
      ...process.env,
      PORTA_GRPC: PORTA,
      AMBIENTE_EXECUCAO: "desenvolvimento",
      PROVEDOR_EMAIL: process.env.PROVEDOR_EMAIL ?? "log",
      SEGREDO_JWT:
        process.env.SEGREDO_JWT ??
        "segredo-jwt-de-teste-com-mais-de-32-caracteres",
      SEGREDO_CODIGO_EMAIL: SEGREDO_CODIGO,
      SEGREDO_HASH_PARTICIPANTE:
        process.env.SEGREDO_HASH_PARTICIPANTE ??
        "segredo-hash-de-teste-com-mais-de-32-caracteres",
      URL_PUBLICA_FRONTEND:
        process.env.URL_PUBLICA_FRONTEND ?? "http://localhost:3000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  processosFilhos.push(processo);
  const saida = [];
  processo.stdout.on("data", (dado) => saida.push(dado.toString()));
  processo.stderr.on("data", (dado) => saida.push(dado.toString()));

  for (let tentativa = 0; tentativa < 60; tentativa += 1) {
    await esperar(500);
    if (processo.exitCode !== null)
      throw new Error(
        `API encerrou durante a inicializacao:\n${saida.join("")}`,
      );
    try {
      await chamar("ObterIdentidadeAtual", {}, {});
      return saida;
    } catch (erro) {
      // Qualquer resposta gRPC prova que o servidor esta ouvindo: a ausencia de
      // cabecalho de autorizacao devolve UNAUTHENTICATED, o que ja e suficiente.
      if (
        erro.code === grpc.status.UNAUTHENTICATED ||
        erro.code === grpc.status.UNIMPLEMENTED
      )
        return saida;
      // Demais codigos (UNAVAILABLE) indicam que o servidor ainda nao subiu.
    }
  }
  throw new Error(`API nao respondeu na porta ${PORTA}:\n${saida.join("")}`);
}

const banco = new pg.Client(CONFIG_BANCO);

async function principal() {
  await banco.connect();
  const saidaApi = await iniciarApi();
  registrar("API gRPC inicializada", true, `porta ${PORTA}`);

  const idUnico = randomUUID();
  const email = `smoke-${idUnico}@exemplo.test`;
  const senhaOriginal = "SenhaOriginal123";
  const senhaNova = "SenhaRedefinida456";

  // 1. Cadastro: cria a conta, mas não abre sessão antes da verificação
  const cadastro = await chamar("CadastrarUsuario", {
    nome_usuario: "Smoke Fluxo Email",
    email_usuario: email,
    senha_usuario: senhaOriginal,
  });
  const idExterno = cadastro.identidade.id_usuario;
  registrar("CadastrarUsuario cria a conta", Boolean(idExterno));
  registrar(
    "Cadastro não emite sessão antes da verificação",
    cadastro.requer_verificacao_email === true && !cadastro.token_acesso,
  );
  registrar(
    "E-mail inicia como não confirmado",
    cadastro.identidade.email_verificado_usuario === false,
  );

  const usuario = await banco.query(
    "SELECT lcr_usr_id_usuario, lcr_usr_email_verificado_em FROM lcr_usuarios WHERE lcr_usr_email = $1",
    [email],
  );
  const idInterno = usuario.rows[0]?.lcr_usr_id_usuario;
  registrar("Conta persistida no PostgreSQL", Boolean(idInterno));

  // 2. Login antes da verificação: credenciais corretas, mas sem acesso
  const loginBloqueado = await chamar("Entrar", {
    email_usuario: email,
    senha_usuario: senhaOriginal,
  });
  registrar(
    "Login bloqueado sem e-mail confirmado",
    loginBloqueado.requer_verificacao_email === true &&
      !loginBloqueado.token_acesso,
  );

  // 3. Solicitação do código de verificação
  const solicitacao = await chamar("SolicitarVerificacaoEmail", {
    email_usuario: email,
  });
  registrar(
    "SolicitarVerificacaoEmail",
    solicitacao.solicitacao_aceita === true,
    solicitacao.mensagem_resultado,
  );
  registrar(
    "Contrato informa 6 caracteres",
    solicitacao.comprimento_codigo === 6,
  );

  const registro = await banco.query(
    `SELECT lcr_tka_hash_token, lcr_tka_tipo_token, lcr_tka_data_consumo, lcr_tka_data_expiracao
     FROM lcr_tokens_autenticacao WHERE lcr_tka_id_usuario = $1 ORDER BY lcr_tka_data_criacao DESC LIMIT 1`,
    [idInterno],
  );
  const linha = registro.rows[0];
  registrar(
    "Código gravado apenas como hash",
    linha?.lcr_tka_tipo_token === "verificacao_email" &&
      linha.lcr_tka_hash_token.length === 64,
  );
  registrar("Código pendente de consumo", linha?.lcr_tka_data_consumo === null);
  const expiracaoMinutos =
    (new Date(linha.lcr_tka_data_expiracao).getTime() - Date.now()) / 60_000;
  registrar(
    "Expiração de 15 minutos aplicada",
    expiracaoMinutos > 14 && expiracaoMinutos <= 15,
    `${expiracaoMinutos.toFixed(1)} min`,
  );

  // 4. Código errado é recusado e conta tentativa
  let recusouCodigoErrado = false;
  try {
    await chamar("ConfirmarEmail", {
      email_usuario: email,
      codigo_verificacao: "ZZZZZZ",
    });
  } catch (erro) {
    recusouCodigoErrado = erro.code === grpc.status.INVALID_ARGUMENT;
  }
  registrar("ConfirmarEmail recusa código incorreto", recusouCodigoErrado);

  const aposErro = await banco.query(
    "SELECT lcr_tka_quantidade_tentativas FROM lcr_tokens_autenticacao WHERE lcr_tka_id_usuario = $1 AND lcr_tka_tipo_token = $2",
    [idInterno, "verificacao_email"],
  );
  registrar(
    "Tentativa inválida contabilizada",
    aposErro.rows[0]?.lcr_tka_quantidade_tentativas === 1,
  );

  // 5. Caminho feliz: código válido confirma o e-mail
  const codigoVerificacao = gerarCodigo();
  await injetarCodigo(idInterno, "verificacao_email", codigoVerificacao, 30);
  const confirmacao = await chamar("ConfirmarEmail", {
    email_usuario: email,
    codigo_verificacao: codigoVerificacao,
  });
  registrar(
    "ConfirmarEmail com código válido",
    confirmacao.email_confirmado === true &&
      confirmacao.email_usuario === email,
  );

  const usuarioVerificado = await banco.query(
    "SELECT lcr_usr_email_verificado_em FROM lcr_usuarios WHERE lcr_usr_id_usuario = $1",
    [idInterno],
  );
  registrar(
    "Data de verificação gravada",
    usuarioVerificado.rows[0].lcr_usr_email_verificado_em !== null,
  );

  let recusouReuso = false;
  try {
    await chamar("ConfirmarEmail", {
      email_usuario: email,
      codigo_verificacao: codigoVerificacao,
    });
  } catch (erro) {
    recusouReuso = erro.code === grpc.status.INVALID_ARGUMENT;
  }
  registrar("Código de verificação não pode ser reutilizado", recusouReuso);

  // 6. Agora o login libera a sessão
  const loginLiberado = await chamar("Entrar", {
    email_usuario: email,
    senha_usuario: senhaOriginal,
  });
  registrar(
    "Login liberado após a confirmação",
    Boolean(loginLiberado.token_acesso) &&
      loginLiberado.requer_verificacao_email === false,
  );

  const identidadeVerificada = await chamar(
    "ObterIdentidadeAtual",
    {},
    { authorization: `Bearer ${loginLiberado.token_acesso}` },
  );
  registrar(
    "Identidade reporta e-mail confirmado",
    identidadeVerificada.email_verificado_usuario === true,
  );

  // 7. Recuperação de senha
  const recuperacao = await chamar("SolicitarRecuperacaoSenha", {
    email_usuario: email,
  });
  registrar(
    "SolicitarRecuperacaoSenha",
    recuperacao.solicitacao_aceita === true,
    recuperacao.mensagem_resultado,
  );
  const neutraInexistente = await chamar("SolicitarRecuperacaoSenha", {
    email_usuario: `inexistente-${idUnico}@exemplo.test`,
  });
  registrar(
    "Resposta neutra para e-mail inexistente",
    neutraInexistente.solicitacao_aceita === true &&
      neutraInexistente.mensagem_resultado === recuperacao.mensagem_resultado,
  );

  const registroRedefinicao = await banco.query(
    `SELECT lcr_tka_data_expiracao FROM lcr_tokens_autenticacao
     WHERE lcr_tka_id_usuario = $1 AND lcr_tka_tipo_token = 'redefinicao_senha' ORDER BY lcr_tka_data_criacao DESC LIMIT 1`,
    [idInterno],
  );
  const expiracaoRedefinicao =
    (new Date(registroRedefinicao.rows[0].lcr_tka_data_expiracao).getTime() -
      Date.now()) /
    60_000;
  registrar(
    "Expiração de 15 minutos na redefinição",
    expiracaoRedefinicao > 14 && expiracaoRedefinicao <= 15,
    `${expiracaoRedefinicao.toFixed(1)} min`,
  );

  const sessaoAntes = await banco.query(
    "SELECT COUNT(*)::int AS total FROM lcr_sessoes WHERE lcr_ses_id_usuario = $1 AND lcr_ses_data_revogacao IS NULL",
    [idInterno],
  );
  registrar(
    "Sessão ativa antes da redefinição",
    sessaoAntes.rows[0].total >= 1,
    `${sessaoAntes.rows[0].total} sessão(ões)`,
  );

  // 8. Redefinição recusa código inexistente e senha fora da política
  let recusouRedefinicaoInvalida = false;
  try {
    await chamar("RedefinirSenha", {
      email_usuario: email,
      codigo_redefinicao: "ZZZZZZ",
      nova_senha_usuario: senhaNova,
    });
  } catch (erro) {
    recusouRedefinicaoInvalida = erro.code === grpc.status.INVALID_ARGUMENT;
  }
  registrar(
    "RedefinirSenha recusa código inexistente",
    recusouRedefinicaoInvalida,
  );

  let recusouSenhaFraca = false;
  try {
    await chamar("RedefinirSenha", {
      email_usuario: email,
      codigo_redefinicao: "BCDFGH",
      nova_senha_usuario: "fraca",
    });
  } catch (erro) {
    recusouSenhaFraca = erro.code === grpc.status.INVALID_ARGUMENT;
  }
  registrar("RedefinirSenha recusa senha fora da política", recusouSenhaFraca);

  // 9. Caminho feliz da redefinição
  const codigoRedefinicao = gerarCodigo();
  await injetarCodigo(idInterno, "redefinicao_senha", codigoRedefinicao, 30);
  const redefinicao = await chamar("RedefinirSenha", {
    email_usuario: email,
    codigo_redefinicao: codigoRedefinicao,
    nova_senha_usuario: senhaNova,
  });
  registrar(
    "RedefinirSenha com código válido",
    redefinicao.senha_redefinida === true,
    `${redefinicao.sessoes_revogadas} sessão(ões) revogada(s)`,
  );

  const sessoesDepois = await banco.query(
    "SELECT COUNT(*)::int AS total FROM lcr_sessoes WHERE lcr_ses_id_usuario = $1 AND lcr_ses_data_revogacao IS NULL",
    [idInterno],
  );
  registrar(
    "Sessões encerradas após a redefinição",
    sessoesDepois.rows[0].total === 0,
  );

  let loginAntigoRecusado = false;
  try {
    await chamar("Entrar", {
      email_usuario: email,
      senha_usuario: senhaOriginal,
    });
  } catch (erro) {
    loginAntigoRecusado = erro.code === grpc.status.UNAUTHENTICATED;
  }
  registrar("Senha antiga não autentica mais", loginAntigoRecusado);

  const loginNovo = await chamar("Entrar", {
    email_usuario: email,
    senha_usuario: senhaNova,
  });
  registrar("Nova senha autentica", Boolean(loginNovo.token_acesso));

  let recusouReusoRedefinicao = false;
  try {
    await chamar("RedefinirSenha", {
      email_usuario: email,
      codigo_redefinicao: codigoRedefinicao,
      nova_senha_usuario: "OutraSenhaSegura789",
    });
  } catch (erro) {
    recusouReusoRedefinicao = erro.code === grpc.status.INVALID_ARGUMENT;
  }
  registrar(
    "Código de redefinição não pode ser reutilizado",
    recusouReusoRedefinicao,
  );

  // 10. Rate limit por identificador
  let bloqueou = false;
  for (let tentativa = 0; tentativa < 6; tentativa += 1) {
    try {
      await chamar("SolicitarRecuperacaoSenha", { email_usuario: email });
    } catch (erro) {
      if (erro.code === grpc.status.RESOURCE_EXHAUSTED) {
        bloqueou = true;
        break;
      }
    }
  }
  registrar("Rate limit bloqueia excesso de solicitações", bloqueou);

  // 11. Auditoria registrada sem expor o código
  const auditoria = await banco.query(
    `SELECT lcr_aud_tipo_evento, lcr_aud_detalhes_evento::text AS detalhes
     FROM lcr_registros_auditoria WHERE lcr_aud_id_usuario = $1 ORDER BY lcr_aud_data_criacao ASC`,
    [idInterno],
  );
  const tipos = auditoria.rows.map(
    (linhaAuditoria) => linhaAuditoria.lcr_aud_tipo_evento,
  );
  registrar(
    "Auditoria de solicitação de verificação",
    tipos.includes("verificacao_email_solicitada"),
  );
  registrar(
    "Auditoria de confirmação de e-mail",
    tipos.includes("email_confirmado"),
  );
  registrar(
    "Auditoria de solicitação de recuperação",
    tipos.includes("recuperacao_senha_solicitada"),
  );
  const detalhesAuditoria = auditoria.rows
    .map((item) => item.detalhes ?? "")
    .join(" ");
  registrar(
    "Código nunca gravado na auditoria",
    !detalhesAuditoria.includes(codigoVerificacao) &&
      !detalhesAuditoria.includes(codigoRedefinicao),
  );

  // 12. Segredos nunca aparecem nos logs da API
  const logs = saidaApi.join("");
  const chave = process.env.RESEND_CHAVE_API?.trim();
  registrar(
    "Chave do Resend ausente dos logs",
    !chave || !logs.includes(chave),
  );
  registrar(
    "Log não contém corpo de e-mail com código",
    !logs.includes(codigoVerificacao) && !logs.includes(codigoRedefinicao),
  );

  // Limpeza
  await banco.query(
    "DELETE FROM lcr_tokens_autenticacao WHERE lcr_tka_id_usuario = $1",
    [idInterno],
  );
  await banco.query("DELETE FROM lcr_sessoes WHERE lcr_ses_id_usuario = $1", [
    idInterno,
  ]);
  await banco.query(
    "DELETE FROM lcr_registros_auditoria WHERE lcr_aud_id_usuario = $1",
    [idInterno],
  );
  await banco.query(
    "DELETE FROM lcr_usuarios_papeis WHERE lcr_upr_id_usuario = $1",
    [idInterno],
  );
  await banco.query("DELETE FROM lcr_usuarios WHERE lcr_usr_id_usuario = $1", [
    idInterno,
  ]);
  registrar("Limpeza dos dados de teste", true, idExterno);

  const aprovados = resultados.filter((item) => item.aprovado).length;
  console.log(`\n${aprovados}/${resultados.length} verificações aprovadas`);
  return aprovados === resultados.length ? 0 : 1;
}

let codigoSaida = 1;
try {
  codigoSaida = await principal();
} catch (erro) {
  console.error("Falha no smoke test:", erro.message);
} finally {
  for (const processo of processosFilhos) processo.kill("SIGTERM");
  await esperar(500);
  await banco.end().catch(() => {});
}
process.exit(codigoSaida);
