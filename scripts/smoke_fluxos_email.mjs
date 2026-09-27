/**
 * Smoke test real dos fluxos de e-mail contra a API gRPC compilada.
 *
 * Uso:
 *   URL_BANCO_DADOS=... URL_REDIS=... PROVEDOR_EMAIL=log pnpm compilar
 *   node scripts/smoke_fluxos_email.mjs
 *
 * O script inicia a API em uma porta isolada, executa o fluxo completo
 * (cadastro → verificação → recuperação → redefinição) e valida o banco.
 * Nenhum e-mail real é enviado quando PROVEDOR_EMAIL=log.
 */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as esperar } from 'node:timers/promises';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import pg from 'pg';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = process.env.PORTA_SMOKE ?? '50999';
const URL_BANCO = process.env.URL_BANCO_DADOS;

if (!URL_BANCO) {
  console.error('URL_BANCO_DADOS nao configurada');
  process.exit(1);
}

const resultados = [];
function registrar(nome, aprovado, detalhe = '') {
  resultados.push({ nome, aprovado, detalhe });
  console.log(`${aprovado ? '[ok]  ' : '[falha]'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
}

function hashToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Injeta um token conhecido diretamente no banco, na mesma forma em que a API grava.
 * Isso permite validar o caminho feliz do gRPC sem depender do e-mail real.
 */
async function injetarToken(idUsuario, tipo, token, minutosValidade) {
  await banco.query(
    `INSERT INTO lcr_tokens_autenticacao (
       lcr_tka_id_usuario, lcr_tka_tipo_token, lcr_tka_hash_token, lcr_tka_data_expiracao
     ) VALUES ($1, $2, $3, $4)`,
    [idUsuario, tipo, hashToken(token), new Date(Date.now() + minutosValidade * 60_000)],
  );
}

const definicao = protoLoader.loadSync(join(raiz, 'contratos/lixo_certo/v1/servico_autenticacao.proto'), {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(definicao).lixo_certo.v1;

const cliente = new proto.ServicoAutenticacao(`127.0.0.1:${PORTA}`, grpc.credentials.createInsecure());

function chamar(metodo, requisicao, cabecalhos = {}) {
  const metadados = new grpc.Metadata();
  for (const [nome, valor] of Object.entries(cabecalhos)) metadados.set(nome, valor);
  return new Promise((aceitar, rejeitar) => {
    cliente[metodo](requisicao, metadados, (erro, resposta) => (erro ? rejeitar(erro) : aceitar(resposta)));
  });
}

const processosFilhos = [];
async function iniciarApi() {
  const processo = spawn('node', ['dist/src/principal.js'], {
    cwd: raiz,
    env: {
      ...process.env,
      PORTA_GRPC: PORTA,
      AMBIENTE_EXECUCAO: 'desenvolvimento',
      PROVEDOR_EMAIL: process.env.PROVEDOR_EMAIL ?? 'log',
      SEGREDO_JWT: process.env.SEGREDO_JWT ?? 'segredo-jwt-de-teste-com-mais-de-32-caracteres',
      SEGREDO_HASH_PARTICIPANTE: process.env.SEGREDO_HASH_PARTICIPANTE ?? 'segredo-hash-de-teste-com-mais-de-32-caracteres',
      URL_PUBLICA_FRONTEND: process.env.URL_PUBLICA_FRONTEND ?? 'http://localhost:3000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processosFilhos.push(processo);
  const saida = [];
  processo.stdout.on('data', dado => saida.push(dado.toString()));
  processo.stderr.on('data', dado => saida.push(dado.toString()));

  for (let tentativa = 0; tentativa < 60; tentativa += 1) {
    await esperar(500);
    if (processo.exitCode !== null) throw new Error(`API encerrou durante a inicializacao:\n${saida.join('')}`);
    try {
      await chamar('ObterIdentidadeAtual', {}, {});
      return saida;
    } catch (erro) {
      // Qualquer resposta gRPC prova que o servidor esta ouvindo: a ausencia de
      // cabecalho de autorizacao devolve UNAUTHENTICATED, o que ja e suficiente.
      if (erro.code === grpc.status.UNAUTHENTICATED || erro.code === grpc.status.UNIMPLEMENTED) return saida;
      // Demais codigos (UNAVAILABLE) indicam que o servidor ainda nao subiu.
    }
  }
  throw new Error(`API nao respondeu na porta ${PORTA}:\n${saida.join('')}`);
}

const banco = new pg.Client({ connectionString: URL_BANCO });

async function principal() {
  await banco.connect();
  const saidaApi = await iniciarApi();
  registrar('API gRPC inicializada', true, `porta ${PORTA}`);

  const idUnico = randomUUID();
  const email = `smoke-${idUnico}@exemplo.test`;
  const senhaOriginal = 'SenhaOriginal123';
  const senhaNova = 'SenhaRedefinida456';

  // 1. Cadastro
  const cadastro = await chamar('CadastrarUsuario', {
    nome_usuario: 'Smoke Fluxo Email',
    email_usuario: email,
    senha_usuario: senhaOriginal,
  });
  const idExterno = cadastro.identidade.id_usuario;
  registrar('CadastrarUsuario', Boolean(cadastro.token_acesso && cadastro.token_atualizacao));
  registrar('E-mail inicia como não confirmado', cadastro.identidade.email_verificado_usuario === false);

  const usuario = await banco.query('SELECT lcr_usr_id_usuario, lcr_usr_email_verificado_em FROM lcr_usuarios WHERE lcr_usr_email = $1', [email]);
  const idInterno = usuario.rows[0]?.lcr_usr_id_usuario;
  registrar('Conta persistida no PostgreSQL', Boolean(idInterno));

  // 2. Solicitação de verificação de e-mail
  const solicitacao = await chamar('SolicitarVerificacaoEmail', { email_usuario: email });
  registrar('SolicitarVerificacaoEmail', solicitacao.solicitacao_aceita === true, solicitacao.mensagem_resultado);

  const tokenRegistro = await banco.query(
    `SELECT lcr_tka_hash_token, lcr_tka_tipo_token, lcr_tka_data_consumo, lcr_tka_data_expiracao
     FROM lcr_tokens_autenticacao WHERE lcr_tka_id_usuario = $1 ORDER BY lcr_tka_data_criacao DESC LIMIT 1`,
    [idInterno],
  );
  const registro = tokenRegistro.rows[0];
  registrar('Token de verificação gravado como hash', registro?.lcr_tka_tipo_token === 'verificacao_email' && registro.lcr_tka_hash_token.length === 64);
  registrar('Token pendente de consumo', registro?.lcr_tka_data_consumo === null);
  const expiracaoHoras = (new Date(registro.lcr_tka_data_expiracao).getTime() - Date.now()) / 3_600_000;
  registrar('Expiração de 24 horas aplicada', expiracaoHoras > 23 && expiracaoHoras <= 24, `${expiracaoHoras.toFixed(2)} h`);

  // O token em texto claro não é recuperável: um valor inventado deve ser recusado.
  let recusouTokenInvalido = false;
  try {
    await chamar('ConfirmarEmail', { token_verificacao: 'a'.repeat(43) });
  } catch (erro) {
    recusouTokenInvalido = erro.code === grpc.status.INVALID_ARGUMENT;
  }
  registrar('ConfirmarEmail recusa token inexistente', recusouTokenInvalido);

  // 3. Recuperação de senha
  const recuperacao = await chamar('SolicitarRecuperacaoSenha', { email_usuario: email });
  registrar('SolicitarRecuperacaoSenha', recuperacao.solicitacao_aceita === true, recuperacao.mensagem_resultado);
  const neutraInexistente = await chamar('SolicitarRecuperacaoSenha', { email_usuario: `inexistente-${idUnico}@exemplo.test` });
  registrar('Resposta neutra para e-mail inexistente', neutraInexistente.solicitacao_aceita === true && neutraInexistente.mensagem_resultado === recuperacao.mensagem_resultado);

  const registroRedefinicao = await banco.query(
    `SELECT lcr_tka_data_expiracao FROM lcr_tokens_autenticacao
     WHERE lcr_tka_id_usuario = $1 AND lcr_tka_tipo_token = 'redefinicao_senha' ORDER BY lcr_tka_data_criacao DESC LIMIT 1`,
    [idInterno],
  );
  const expiracaoMinutos = (new Date(registroRedefinicao.rows[0].lcr_tka_data_expiracao).getTime() - Date.now()) / 60_000;
  registrar('Expiração de 60 minutos aplicada', expiracaoMinutos > 59 && expiracaoMinutos <= 60, `${expiracaoMinutos.toFixed(1)} min`);

  // Sessão aberta antes da redefinição deve ser revogada.
  const sessaoAntes = await banco.query('SELECT COUNT(*)::int AS total FROM lcr_sessoes WHERE lcr_ses_id_usuario = $1 AND lcr_ses_data_revogacao IS NULL', [idInterno]);
  registrar('Sessão ativa antes da redefinição', sessaoAntes.rows[0].total >= 1, `${sessaoAntes.rows[0].total} sessão(ões)`);

  // 4. Redefinição com token inválido
  let recusouRedefinicaoInvalida = false;
  try {
    await chamar('RedefinirSenha', { token_redefinicao: 'b'.repeat(43), nova_senha_usuario: senhaNova });
  } catch (erro) {
    recusouRedefinicaoInvalida = erro.code === grpc.status.INVALID_ARGUMENT;
  }
  registrar('RedefinirSenha recusa token inexistente', recusouRedefinicaoInvalida);

  // 5. Redefinição com senha fora da política
  let recusouSenhaFraca = false;
  try {
    await chamar('RedefinirSenha', { token_redefinicao: 'c'.repeat(43), nova_senha_usuario: 'fraca' });
  } catch (erro) {
    recusouSenhaFraca = erro.code === grpc.status.INVALID_ARGUMENT;
  }
  registrar('RedefinirSenha recusa senha fora da política', recusouSenhaFraca);

  // 6. Login com a senha original continua funcionando (nenhuma troca ocorreu)
  const loginOriginal = await chamar('Entrar', { email_usuario: email, senha_usuario: senhaOriginal });
  registrar('Entrar com a senha original', Boolean(loginOriginal.token_acesso));

  // 6.1 Caminho feliz da confirmação de e-mail com token válido
  const tokenVerificacao = `smoke-verificacao-${randomUUID()}`.replace(/-/g, '');
  await injetarToken(idInterno, 'verificacao_email', tokenVerificacao, 30);
  const confirmacao = await chamar('ConfirmarEmail', { token_verificacao: tokenVerificacao });
  registrar('ConfirmarEmail com token válido', confirmacao.email_confirmado === true && confirmacao.email_usuario === email);

  const usuarioVerificado = await banco.query('SELECT lcr_usr_email_verificado_em FROM lcr_usuarios WHERE lcr_usr_id_usuario = $1', [idInterno]);
  registrar('Data de verificação gravada', usuarioVerificado.rows[0].lcr_usr_email_verificado_em !== null);

  let recusouReuso = false;
  try {
    await chamar('ConfirmarEmail', { token_verificacao: tokenVerificacao });
  } catch (erro) {
    recusouReuso = erro.code === grpc.status.INVALID_ARGUMENT;
  }
  registrar('Token de verificação não pode ser reutilizado', recusouReuso);

  const identidadeVerificada = await chamar('ObterIdentidadeAtual', {}, { authorization: `Bearer ${loginOriginal.token_acesso}` });
  registrar('Identidade reporta e-mail confirmado', identidadeVerificada.email_verificado_usuario === true);

  // 6.2 Caminho feliz da redefinição de senha com token válido
  const tokenRedefinicao = `smoke-redefinicao-${randomUUID()}`.replace(/-/g, '');
  await injetarToken(idInterno, 'redefinicao_senha', tokenRedefinicao, 30);
  const redefinicao = await chamar('RedefinirSenha', { token_redefinicao: tokenRedefinicao, nova_senha_usuario: senhaNova });
  registrar('RedefinirSenha com token válido', redefinicao.senha_redefinida === true, `${redefinicao.sessoes_revogadas} sessão(ões) revogada(s)`);

  const sessoesDepois = await banco.query('SELECT COUNT(*)::int AS total FROM lcr_sessoes WHERE lcr_ses_id_usuario = $1 AND lcr_ses_data_revogacao IS NULL', [idInterno]);
  registrar('Sessões encerradas após a redefinição', sessoesDepois.rows[0].total === 0);

  let loginAntigoRecusado = false;
  try {
    await chamar('Entrar', { email_usuario: email, senha_usuario: senhaOriginal });
  } catch (erro) {
    loginAntigoRecusado = erro.code === grpc.status.UNAUTHENTICATED;
  }
  registrar('Senha antiga não autentica mais', loginAntigoRecusado);

  const loginNovo = await chamar('Entrar', { email_usuario: email, senha_usuario: senhaNova });
  registrar('Nova senha autentica', Boolean(loginNovo.token_acesso));

  let recusouReusoRedefinicao = false;
  try {
    await chamar('RedefinirSenha', { token_redefinicao: tokenRedefinicao, nova_senha_usuario: 'OutraSenhaSegura789' });
  } catch (erro) {
    recusouReusoRedefinicao = erro.code === grpc.status.INVALID_ARGUMENT;
  }
  registrar('Token de redefinição não pode ser reutilizado', recusouReusoRedefinicao);

  // 7. Rate limit por identificador
  let bloqueou = false;
  for (let tentativa = 0; tentativa < 6; tentativa += 1) {
    try {
      await chamar('SolicitarRecuperacaoSenha', { email_usuario: email });
    } catch (erro) {
      if (erro.code === grpc.status.RESOURCE_EXHAUSTED) {
        bloqueou = true;
        break;
      }
    }
  }
  registrar('Rate limit bloqueia excesso de solicitações', bloqueou);

  // 8. Auditoria registrada sem expor tokens
  const auditoria = await banco.query(
    `SELECT lcr_aud_tipo_evento, lcr_aud_detalhes_evento::text AS detalhes
     FROM lcr_registros_auditoria WHERE lcr_aud_id_usuario = $1 ORDER BY lcr_aud_data_criacao ASC`,
    [idInterno],
  );
  const tipos = auditoria.rows.map(linha => linha.lcr_aud_tipo_evento);
  registrar('Auditoria de solicitação de verificação', tipos.includes('verificacao_email_solicitada'));
  registrar('Auditoria de solicitação de recuperação', tipos.includes('recuperacao_senha_solicitada'));
  const vazouToken = auditoria.rows.some(linha => /[A-Za-z0-9_-]{43,}/.test(linha.detalhes ?? ''));
  registrar('Nenhum token gravado na auditoria', !vazouToken);

  // 9. Chave do Resend nunca aparece nos logs da API
  const logs = saidaApi.join('');
  const chave = process.env.RESEND_CHAVE_API?.trim();
  registrar('Chave do Resend ausente dos logs', !chave || !logs.includes(chave));
  registrar('Log não contém corpo de e-mail com token', !/token=[A-Za-z0-9_-]{43,}/.test(logs));

  // Limpeza
  await banco.query('DELETE FROM lcr_tokens_autenticacao WHERE lcr_tka_id_usuario = $1', [idInterno]);
  await banco.query('DELETE FROM lcr_sessoes WHERE lcr_ses_id_usuario = $1', [idInterno]);
  await banco.query('DELETE FROM lcr_registros_auditoria WHERE lcr_aud_id_usuario = $1', [idInterno]);
  await banco.query('DELETE FROM lcr_usuarios_papeis WHERE lcr_upr_id_usuario = $1', [idInterno]);
  await banco.query('DELETE FROM lcr_usuarios WHERE lcr_usr_id_usuario = $1', [idInterno]);
  registrar('Limpeza dos dados de teste', true, idExterno);

  const aprovados = resultados.filter(item => item.aprovado).length;
  console.log(`\n${aprovados}/${resultados.length} verificações aprovadas`);
  return aprovados === resultados.length ? 0 : 1;
}

let codigoSaida = 1;
try {
  codigoSaida = await principal();
} catch (erro) {
  console.error('Falha no smoke test:', erro.message);
} finally {
  for (const processo of processosFilhos) processo.kill('SIGTERM');
  await esperar(500);
  await banco.end().catch(() => {});
}
process.exit(codigoSaida);
