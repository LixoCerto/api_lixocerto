import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { QueryTypes } from 'sequelize';
import { criarConexaoBanco } from '../../src/infraestrutura/banco/conexao.js';
import { criarConexaoRedis } from '../../src/infraestrutura/cache/conexao_redis.js';
import { ServicoRateLimit } from '../../src/infraestrutura/cache/rate_limit.servico.js';
import { ModeloSessao } from '../../src/infraestrutura/banco/modelos/sessao.modelo.js';
import { ModeloTokenAutenticacao } from '../../src/infraestrutura/banco/modelos/token_autenticacao.modelo.js';
import { ModeloUsuario } from '../../src/infraestrutura/banco/modelos/usuario.modelo.js';
import { ServicoEmail, type MensagemEmail, type ResultadoEnvioEmail } from '../../src/infraestrutura/email/email.servico.js';
import { RepositorioAuditoria } from '../../src/modulos/auditoria/auditoria.repositorio.js';
import { ServicoAuditoria } from '../../src/modulos/auditoria/auditoria.servico.js';
import { ServicoFluxosEmail } from '../../src/modulos/autenticacao/fluxos_email.servico.js';
import { hashCodigoVerificacao } from '../../src/modulos/autenticacao/codigo_verificacao.util.js';
import { RepositorioTokensAutenticacao } from '../../src/modulos/autenticacao/tokens_autenticacao.repositorio.js';
import { criarHashSenha, verificarSenha } from '../../src/modulos/autenticacao/senha.util.js';
import { ServicoUsuarios } from '../../src/modulos/usuarios/usuarios.servico.js';

const urlBanco = process.env.URL_BANCO_DADOS_TESTE ?? process.env.URL_BANCO_DADOS;
const urlRedis = process.env.URL_REDIS_TESTE ?? process.env.URL_REDIS;
if (urlBanco) process.env.URL_BANCO_DADOS = urlBanco;
if (urlRedis) process.env.URL_REDIS = urlRedis;

const banco = urlBanco ? criarConexaoBanco() : null;
const redis = urlRedis ? criarConexaoRedis() : null;
const idsUsuarios: string[] = [];

/**
 * Substitui o provedor real por um coletor em memória.
 * O teste valida o fluxo completo (código, persistência, consumo único) sem enviar e-mail real.
 */
class EmailColetor extends ServicoEmail {
  readonly mensagens: MensagemEmail[] = [];
  private readonly enviados: string[] = [];

  override async enviar(mensagem: MensagemEmail): Promise<ResultadoEnvioEmail> {
    this.mensagens.push(mensagem);
    this.enviados.push(mensagem.destinatario);
    return { enviado: true, provedor: 'resend', idMensagem: `teste:${this.enviados.length}`, motivo: null };
  }

  /** Extrai o código de 6 caracteres do corpo em texto da mensagem. */
  extrairCodigo(indice = 0): string {
    const mensagem = this.mensagens[indice];
    const correspondencia = mensagem?.texto.match(expressaoCodigoVerificacao());
    if (!correspondencia?.[0]) throw new Error('Código ausente na mensagem de teste');
    return correspondencia[0];
  }
}

const bancoDescribe = describe.skipIf(!banco);

beforeAll(() => {
  // Segredo dedicado do HMAC do código; em produção vem do ambiente.
  process.env.SEGREDO_CODIGO_EMAIL ??= 'segredo-de-teste-com-mais-de-32-caracteres-para-hmac';
});

afterAll(async () => {
  if (banco) {
    for (const idUsuario of idsUsuarios) {
      await ModeloTokenAutenticacao.destroy({ where: { lcr_tka_id_usuario: idUsuario } });
      await ModeloSessao.destroy({ where: { lcr_ses_id_usuario: idUsuario } });
      await banco.query('DELETE FROM lcr_usuarios_papeis WHERE lcr_upr_id_usuario = :idUsuario', { replacements: { idUsuario } });
      await ModeloUsuario.destroy({ where: { lcr_usr_id_usuario: idUsuario } });
    }
    await banco.close();
  }
  if (redis && redis.status !== 'end') await redis.quit();
});

async function criarCenario() {
  const usuarios = new ServicoUsuarios(banco);
  const tokens = new RepositorioTokensAutenticacao(banco);
  const email = new EmailColetor();
  const auditoria = new ServicoAuditoria(new RepositorioAuditoria(banco));
  const rateLimit = new ServicoRateLimit(redis);
  const fluxos = new ServicoFluxosEmail(usuarios, tokens, email, auditoria, rateLimit);

  const identificador = `email-${randomUUID()}`;
  const emailUsuario = `${identificador}@exemplo.test`;
  const identidade = await usuarios.cadastrarUsuarioLocal({
    nome: 'Usuário Fluxo E-mail',
    email: emailUsuario,
    hashSenha: await criarHashSenha('SenhaOriginal123'),
  });
  // O serviço gera o identificador externo; a busca é feita pelo e-mail informado.
  const usuario = await ModeloUsuario.findOne({ where: { lcr_usr_email: emailUsuario } });
  if (!usuario) throw new Error('Usuário de teste não criado');
  idsUsuarios.push(usuario.lcr_usr_id_usuario);

  return {
    usuarios,
    tokens,
    email,
    auditoria,
    fluxos,
    idExterno: identidade.idExterno,
    emailUsuario,
    idInterno: usuario.lcr_usr_id_usuario,
  };
}

bancoDescribe('integração dos fluxos de e-mail', () => {
  it('persiste somente o hash do código e confirma o e-mail uma única vez', async () => {
    const cenario = await criarCenario();

    const solicitacao = await cenario.fluxos.solicitarVerificacaoEmail(cenario.emailUsuario, { enderecoIp: '10.0.0.1' });
    expect(solicitacao.solicitacaoAceita).toBe(true);
    expect(solicitacao.comprimentoCodigo).toBe(6);
    expect(cenario.email.mensagens).toHaveLength(1);

    const codigo = cenario.email.extrairCodigo();
    const registro = await ModeloTokenAutenticacao.findOne({ where: { lcr_tka_id_usuario: cenario.idInterno } });
    expect(registro).toBeTruthy();
    // O código em texto claro nunca é persistido, e o hash usa HMAC com chave.
    expect(registro!.lcr_tka_hash_token).not.toBe(codigo);
    expect(registro!.lcr_tka_hash_token).toHaveLength(64);
    expect(registro!.lcr_tka_hash_token).toBe(hashCodigoVerificacao(codigo, 'verificacao_email'));
    expect(registro!.lcr_tka_tipo_token).toBe('verificacao_email');
    expect(registro!.lcr_tka_data_consumo).toBeNull();

    const confirmacao = await cenario.fluxos.confirmarEmail(cenario.emailUsuario, codigo, { enderecoIp: '10.0.0.1' });
    expect(confirmacao.emailConfirmado).toBe(true);
    expect(confirmacao.emailUsuario).toBe(cenario.emailUsuario);

    const usuarioVerificado = await ModeloUsuario.findByPk(cenario.idInterno);
    expect(usuarioVerificado!.lcr_usr_email_verificado_em).toBeInstanceOf(Date);

    const consumido = await ModeloTokenAutenticacao.findOne({ where: { lcr_tka_id_usuario: cenario.idInterno } });
    expect(consumido!.lcr_tka_data_consumo).toBeInstanceOf(Date);

    // Reutilização do mesmo código é recusada.
    await expect(
      cenario.fluxos.confirmarEmail(cenario.emailUsuario, codigo, { enderecoIp: '10.0.0.1' }),
    ).rejects.toThrow('Codigo de verificacao invalido ou expirado');
  });

  it('invalida o código anterior quando um novo é solicitado', async () => {
    const cenario = await criarCenario();

    await cenario.fluxos.solicitarVerificacaoEmail(cenario.emailUsuario, { enderecoIp: '10.0.0.2' });
    const primeiroCodigo = cenario.email.extrairCodigo(0);
    await cenario.fluxos.solicitarVerificacaoEmail(cenario.emailUsuario, { enderecoIp: '10.0.0.2' });
    const segundoCodigo = cenario.email.extrairCodigo(1);

    expect(primeiroCodigo).not.toBe(segundoCodigo);
    await expect(
      cenario.fluxos.confirmarEmail(cenario.emailUsuario, primeiroCodigo, { enderecoIp: '10.0.0.2' }),
    ).rejects.toThrow('Codigo de verificacao invalido ou expirado');
    await expect(
      cenario.fluxos.confirmarEmail(cenario.emailUsuario, segundoCodigo, { enderecoIp: '10.0.0.2' }),
    ).resolves.toMatchObject({ emailConfirmado: true });
  });

  it('invalida o código após atingir o limite de tentativas erradas', async () => {
    const cenario = await criarCenario();
    await cenario.fluxos.solicitarVerificacaoEmail(cenario.emailUsuario, { enderecoIp: '10.0.0.9' });
    const codigoCorreto = cenario.email.extrairCodigo();

    // Quatro erros consomem o limite parcial; o quinto invalida o código.
    for (let tentativa = 0; tentativa < 4; tentativa += 1) {
      await expect(
        cenario.fluxos.confirmarEmail(cenario.emailUsuario, 'ZZZZZZ', { enderecoIp: '10.0.0.9' }),
      ).rejects.toThrow('Codigo de verificacao invalido ou expirado');
    }
    await expect(
      cenario.fluxos.confirmarEmail(cenario.emailUsuario, 'ZZZZZZ', { enderecoIp: '10.0.0.9' }),
    ).rejects.toThrow('Codigo de verificacao invalido ou expirado');

    // Mesmo com o código correto, o registro já foi invalidado.
    await expect(
      cenario.fluxos.confirmarEmail(cenario.emailUsuario, codigoCorreto, { enderecoIp: '10.0.0.9' }),
    ).rejects.toThrow('Codigo de verificacao invalido ou expirado');

    const registro = await ModeloTokenAutenticacao.findOne({ where: { lcr_tka_id_usuario: cenario.idInterno } });
    expect(registro!.lcr_tka_data_consumo).toBeInstanceOf(Date);
    expect(registro!.lcr_tka_quantidade_tentativas).toBe(5);
  });

  it('redefine a senha, troca o hash e revoga todas as sessões abertas', async () => {
    const cenario = await criarCenario();

    // Sessão aberta antes da redefinição, representando acesso com a senha antiga.
    await ModeloSessao.create({
      lcr_ses_id_usuario: cenario.idInterno,
      lcr_ses_hash_token: `hash-${randomUUID()}`,
      lcr_ses_hash_token_atualizacao: `hash-refresh-${randomUUID()}`,
      lcr_ses_data_expiracao: new Date(Date.now() + 3_600_000),
      lcr_ses_data_revogacao: null,
    });

    await cenario.fluxos.solicitarRecuperacaoSenha(cenario.emailUsuario, { enderecoIp: '10.0.0.3' });
    const codigo = cenario.email.extrairCodigo();

    const resposta = await cenario.fluxos.redefinirSenha(cenario.emailUsuario, codigo, 'NovaSenhaSegura456', {
      enderecoIp: '10.0.0.3',
    });
    expect(resposta.senhaRedefinida).toBe(true);
    expect(resposta.sessoesRevogadas).toBeGreaterThanOrEqual(1);

    const usuario = await ModeloUsuario.findByPk(cenario.idInterno);
    expect(await verificarSenha('NovaSenhaSegura456', usuario!.lcr_usr_hash_senha!)).toBe(true);
    expect(await verificarSenha('SenhaOriginal123', usuario!.lcr_usr_hash_senha!)).toBe(false);

    const sessao = await ModeloSessao.findOne({ where: { lcr_ses_id_usuario: cenario.idInterno } });
    expect(sessao!.lcr_ses_data_revogacao).toBeInstanceOf(Date);

    await expect(
      cenario.fluxos.redefinirSenha(cenario.emailUsuario, codigo, 'OutraSenhaSegura789', { enderecoIp: '10.0.0.3' }),
    ).rejects.toThrow('Codigo de redefinicao invalido ou expirado');
  });

  it('não confirma com código de outro usuário', async () => {
    const primeiro = await criarCenario();
    const segundo = await criarCenario();

    await primeiro.fluxos.solicitarVerificacaoEmail(primeiro.emailUsuario, { enderecoIp: '10.0.0.6' });
    const codigoDoPrimeiro = primeiro.email.extrairCodigo();
    await segundo.fluxos.solicitarVerificacaoEmail(segundo.emailUsuario, { enderecoIp: '10.0.0.6' });

    await expect(
      segundo.fluxos.confirmarEmail(segundo.emailUsuario, codigoDoPrimeiro, { enderecoIp: '10.0.0.6' }),
    ).rejects.toThrow('Codigo de verificacao invalido ou expirado');

    const usuarioSegundo = await ModeloUsuario.findByPk(segundo.idInterno);
    expect(usuarioSegundo!.lcr_usr_email_verificado_em).toBeNull();
  });

  it('responde de forma neutra para e-mail inexistente e não cria código', async () => {
    const cenario = await criarCenario();
    const resposta = await cenario.fluxos.solicitarRecuperacaoSenha(`inexistente-${randomUUID()}@exemplo.test`, {
      enderecoIp: '10.0.0.4',
    });

    expect(resposta.solicitacaoAceita).toBe(true);
    expect(resposta.mensagemResultado).toContain('Se o endereco informado estiver cadastrado');
    expect(cenario.email.mensagens).toHaveLength(0);
    const quantidade = await ModeloTokenAutenticacao.count({ where: { lcr_tka_id_usuario: cenario.idInterno } });
    expect(quantidade).toBe(0);
  });

  it('registra auditoria dos eventos sem gravar o código', async () => {
    const cenario = await criarCenario();
    await cenario.fluxos.solicitarVerificacaoEmail(cenario.emailUsuario, { enderecoIp: '10.0.0.5' });
    const codigo = cenario.email.extrairCodigo();
    await cenario.fluxos.confirmarEmail(cenario.emailUsuario, codigo, { enderecoIp: '10.0.0.5' });

    const registros = await banco!.query<{ lcr_aud_tipo_evento: string; lcr_aud_detalhes_evento: unknown }>(
      `SELECT lcr_aud_tipo_evento, lcr_aud_detalhes_evento FROM lcr_registros_auditoria
       WHERE lcr_aud_id_usuario = :idUsuario ORDER BY lcr_aud_data_criacao ASC`,
      { replacements: { idUsuario: cenario.idInterno }, type: QueryTypes.SELECT },
    );
    const tipos = registros.map(item => item.lcr_aud_tipo_evento);
    expect(tipos).toContain('verificacao_email_solicitada');
    expect(tipos).toContain('email_confirmado');

    // O código nunca aparece nos detalhes de auditoria.
    const detalhesSerializados = JSON.stringify(registros.map(item => item.lcr_aud_detalhes_evento));
    expect(detalhesSerializados).not.toContain(codigo);
  });
});
import { expressaoCodigoVerificacao } from '../../src/modulos/autenticacao/codigo_verificacao.util.js';
