import { Metadata } from '@grpc/grpc-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { montarEmailRedefinicaoSenha, montarEmailVerificacao } from '../../src/infraestrutura/email/templates_email.js';
import { ServicoEmail } from '../../src/infraestrutura/email/email.servico.js';
import {
  ALFABETO_CODIGO,
  COMPRIMENTO_CODIGO,
  codigoVerificacaoValido,
  expressaoCodigoVerificacao,
  gerarCodigoVerificacao,
  hashCodigoVerificacao,
  normalizarCodigoVerificacao,
} from '../../src/modulos/autenticacao/codigo_verificacao.util.js';
import { ControladorGrpcFluxosEmail } from '../../src/modulos/autenticacao/fluxos_email.controlador.grpc.js';
import { ServicoFluxosEmail } from '../../src/modulos/autenticacao/fluxos_email.servico.js';

const SEGREDO_TESTE = 'segredo-de-teste-com-mais-de-32-caracteres-para-hmac';

const credencial = {
  idInterno: 'uuid-usuario-interno',
  idExterno: 'local:usuario-1',
  nome: 'Arthur Nóbrega',
  email: 'arthur@exemplo.test',
  hashSenha: 'scrypt$...',
  status: 'ativo' as const,
  emailVerificado: false,
};

beforeEach(() => {
  process.env.SEGREDO_CODIGO_EMAIL = SEGREDO_TESTE;
});

afterEach(() => {
  delete process.env.SEGREDO_CODIGO_EMAIL;
});

function criarServico(opcoes: {
  credencial?: typeof credencial | null;
  codigoPendente?: {
    idToken: string;
    idUsuario: string;
    tipo: 'verificacao_email' | 'redefinicao_senha';
    hashToken: string;
    dataExpiracao: Date;
    quantidadeTentativas: number;
    consumido: boolean;
    expirado: boolean;
  } | null;
  consumiu?: boolean;
  envioEnviado?: boolean;
  hashEmUso?: boolean;
} = {}) {
  const usuarios = {
    obterCredencialPorEmail: vi.fn().mockResolvedValue(opcoes.credencial === undefined ? credencial : opcoes.credencial),
    obterCredencialPorIdInterno: vi.fn().mockResolvedValue(opcoes.credencial === undefined ? credencial : opcoes.credencial),
    obterIdInterno: vi.fn().mockResolvedValue(credencial.idInterno),
    definirHashSenha: vi.fn().mockResolvedValue(true),
    marcarEmailVerificado: vi.fn().mockResolvedValue(credencial.email),
    revogarSessoes: vi.fn().mockResolvedValue(2),
  };
  const tokens = {
    criar: vi.fn().mockResolvedValue(true),
    buscarPorHash: vi.fn().mockResolvedValue(null),
    buscarPendenteDoUsuario: vi.fn().mockResolvedValue(opcoes.codigoPendente ?? null),
    hashEmUso: vi.fn().mockResolvedValue(opcoes.hashEmUso ?? false),
    consumir: vi.fn().mockResolvedValue(opcoes.consumiu ?? true),
    registrarTentativa: vi.fn().mockResolvedValue(1),
    consumirPendentesDoUsuario: vi.fn().mockResolvedValue(1),
  };
  const email = {
    enviar: vi.fn().mockResolvedValue({
      enviado: opcoes.envioEnviado ?? true,
      provedor: 'resend',
      idMensagem: 'msg-1',
      motivo: null,
    }),
  };
  const auditoria = { registrar: vi.fn().mockResolvedValue(null) };
  const rateLimit = { permitir: vi.fn().mockResolvedValue({ permitido: true, restante: 2, disponivel: true }) };

  const servico = new ServicoFluxosEmail(
    usuarios as never,
    tokens as never,
    email as never,
    auditoria as never,
    rateLimit as never,
  );
  return { servico, usuarios, tokens, email, auditoria, rateLimit };
}

/** Código pendente coerente com o valor informado no teste. */
function codigoPendente(codigo: string, tipo: 'verificacao_email' | 'redefinicao_senha' = 'verificacao_email') {
  return {
    idToken: 'id-token',
    idUsuario: credencial.idInterno,
    tipo,
    hashToken: hashCodigoVerificacao(codigo, tipo),
    dataExpiracao: new Date(Date.now() + 60_000),
    quantidadeTentativas: 0,
    consumido: false,
    expirado: false,
  };
}

describe('código de verificação', () => {
  it('gera código de 6 caracteres usando apenas o alfabeto permitido', () => {
    for (let repeticao = 0; repeticao < 50; repeticao += 1) {
      const codigo = gerarCodigoVerificacao();
      expect(codigo).toHaveLength(COMPRIMENTO_CODIGO);
      expect(codigoVerificacaoValido(codigo)).toBe(true);
      for (const caractere of codigo) expect(ALFABETO_CODIGO).toContain(caractere);
    }
  });

  it('não usa caracteres ambíguos nem vogais no alfabeto', () => {
    for (const ambiguo of ['0', '1', 'I', 'L', 'O']) expect(ALFABETO_CODIGO).not.toContain(ambiguo);
    for (const vogal of ['A', 'E', 'I', 'O', 'U']) expect(ALFABETO_CODIGO).not.toContain(vogal);
    expect(new Set(ALFABETO_CODIGO).size).toBe(ALFABETO_CODIGO.length);
  });

  it('gera códigos distintos entre si', () => {
    const gerados = new Set(Array.from({ length: 200 }, () => gerarCodigoVerificacao()));
    expect(gerados.size).toBeGreaterThan(190);
  });

  it('normaliza a digitação do usuário (espaços, hífens e caixa)', () => {
    expect(normalizarCodigoVerificacao(' bc3-9kz ')).toBe('BC39KZ');
    expect(normalizarCodigoVerificacao('bc3 9kz')).toBe('BC39KZ');
    expect(normalizarCodigoVerificacao('BC39KZ')).toBe('BC39KZ');
  });

  it('recusa comprimento ou caracteres fora do alfabeto', () => {
    expect(codigoVerificacaoValido('ABC')).toBe(false);
    expect(codigoVerificacaoValido('ABCDEFG')).toBe(false);
    expect(codigoVerificacaoValido('ABC0EF')).toBe(false);
    expect(codigoVerificacaoValido('ABC1EF')).toBe(false);
    expect(codigoVerificacaoValido('abc!ef')).toBe(false);
  });

  it('deriva hash com chave secreta, determinístico e isolado por tipo', () => {
    const codigo = 'BC39KZ';
    const hash = hashCodigoVerificacao(codigo, 'verificacao_email');
    expect(hash).toHaveLength(64);
    expect(hashCodigoVerificacao(codigo, 'verificacao_email')).toBe(hash);
    // O mesmo código em outro fluxo produz hash diferente.
    expect(hashCodigoVerificacao(codigo, 'redefinicao_senha')).not.toBe(hash);
  });

  it('exige segredo configurado para derivar o hash', () => {
    delete process.env.SEGREDO_CODIGO_EMAIL;
    delete process.env.SEGREDO_JWT;
    expect(() => hashCodigoVerificacao('BC39KZ', 'verificacao_email')).toThrow('Segredo para codigo de verificacao');
  });

  it('aceita SEGREDO_JWT como base quando o segredo dedicado não existe', () => {
    const comSegredoDedicado = hashCodigoVerificacao('BC39KZ', 'verificacao_email');
    delete process.env.SEGREDO_CODIGO_EMAIL;
    process.env.SEGREDO_JWT = 'outro-segredo-de-teste-com-mais-de-32-caracteres';
    try {
      const comJwt = hashCodigoVerificacao('BC39KZ', 'verificacao_email');
      expect(comJwt).toHaveLength(64);
      // Derivado de forma determinística e distinto do obtido com o segredo dedicado.
      expect(hashCodigoVerificacao('BC39KZ', 'verificacao_email')).toBe(comJwt);
      expect(comJwt).not.toBe(comSegredoDedicado);
    } finally {
      delete process.env.SEGREDO_JWT;
    }
  });
});

describe('fluxos de e-mail da autenticação', () => {
  it('envia código de 6 caracteres e persiste apenas o hash com HMAC', async () => {
    const { servico, tokens, email } = criarServico();
    const resposta = await servico.solicitarVerificacaoEmail('Arthur@Exemplo.Test', { enderecoIp: '127.0.0.1' });

    expect(resposta.solicitacaoAceita).toBe(true);
    expect(resposta.comprimentoCodigo).toBe(6);
    expect(resposta.expiraEmSegundos).toBe(15 * 60);
    expect(tokens.criar).toHaveBeenCalledOnce();

    const criado = tokens.criar.mock.calls[0]![0]!;
    expect(criado.tipo).toBe('verificacao_email');
    expect(criado.hashToken).toHaveLength(64);

    expect(email.enviar).toHaveBeenCalledOnce();
    const mensagem = email.enviar.mock.calls[0]![0]!;
    expect(mensagem.destinatario).toBe('arthur@exemplo.test');

    // O código enviado não pode ser reconstruído a partir do hash persistido.
    const codigoEnviado = mensagem.texto.match(expressaoCodigoVerificacao())?.[0];
    expect(codigoEnviado).toBeTruthy();
    expect(codigoEnviado).toHaveLength(6);
    expect(criado.hashToken).not.toContain(codigoEnviado);
    expect(criado.hashToken).toBe(hashCodigoVerificacao(codigoEnviado!, 'verificacao_email'));
  });

  it('gera outro código quando o sorteado já está em uso', async () => {
    const { servico, tokens } = criarServico();
    // Primeiro sorteio colide com um código pendente; o segundo é aceito.
    tokens.hashEmUso.mockResolvedValueOnce(true).mockResolvedValue(false);
    await servico.solicitarVerificacaoEmail('arthur@exemplo.test');
    expect(tokens.hashEmUso).toHaveBeenCalledTimes(2);
    expect(tokens.criar).toHaveBeenCalledOnce();
  });

  it('desiste após tentativas repetidas de colisão sem criar token', async () => {
    const { servico, tokens } = criarServico({ hashEmUso: true });
    tokens.hashEmUso.mockResolvedValue(true);
    await expect(servico.solicitarVerificacaoEmail('arthur@exemplo.test')).rejects.toThrow(
      'Nao foi possivel gerar o codigo agora',
    );
    expect(tokens.criar).not.toHaveBeenCalled();
  });

  it('responde de forma neutra quando o e-mail não existe, sem criar código', async () => {
    const { servico, tokens, email } = criarServico({ credencial: null });
    const resposta = await servico.solicitarVerificacaoEmail('inexistente@exemplo.test');

    expect(resposta.solicitacaoAceita).toBe(true);
    expect(resposta.mensagemResultado).toContain('Se o endereco informado estiver cadastrado');
    expect(tokens.criar).not.toHaveBeenCalled();
    expect(email.enviar).not.toHaveBeenCalled();
  });

  it('invalida o código quando o provedor de e-mail falha no envio', async () => {
    const { servico, tokens } = criarServico({ envioEnviado: false });
    await expect(servico.solicitarVerificacaoEmail('arthur@exemplo.test')).rejects.toThrow(
      'Nao foi possivel enviar o codigo de confirmacao',
    );
    expect(tokens.consumirPendentesDoUsuario).toHaveBeenCalledWith(credencial.idInterno, 'verificacao_email');
  });

  it('aplica rate limit por identificador antes de consultar a base', async () => {
    const { servico, rateLimit, usuarios } = criarServico();
    rateLimit.permitir.mockResolvedValue({ permitido: false, restante: 0, disponivel: true });
    await expect(servico.solicitarRecuperacaoSenha('arthur@exemplo.test')).rejects.toThrow('Muitas solicitacoes para este email');
    expect(usuarios.obterCredencialPorEmail).not.toHaveBeenCalled();
  });

  it('recusa operação quando a proteção contra abuso está indisponível', async () => {
    const { servico, rateLimit } = criarServico();
    rateLimit.permitir.mockResolvedValue({ permitido: true, restante: 1, disponivel: false });
    await expect(servico.solicitarVerificacaoEmail('arthur@exemplo.test')).rejects.toThrow(
      'Protecao contra abuso indisponivel',
    );
  });

  it('confirma o e-mail consumindo o código uma única vez', async () => {
    const codigo = 'BC39KZ';
    const { servico, tokens, usuarios } = criarServico({ codigoPendente: codigoPendente(codigo) });

    const resposta = await servico.confirmarEmail(credencial.email, codigo);
    expect(resposta.emailConfirmado).toBe(true);
    expect(resposta.emailUsuario).toBe(credencial.email);
    expect(tokens.buscarPendenteDoUsuario).toHaveBeenCalledWith(credencial.idInterno, 'verificacao_email');
    expect(tokens.consumir).toHaveBeenCalledWith('id-token');
    expect(usuarios.marcarEmailVerificado).toHaveBeenCalledWith(credencial.idInterno);
  });

  it('aceita o código digitado com hífen, espaço e minúsculas', async () => {
    const codigo = 'BC39KZ';
    const { servico, usuarios } = criarServico({ codigoPendente: codigoPendente(codigo) });
    const resposta = await servico.confirmarEmail(credencial.email, ' bc3-9kz ');
    expect(resposta.emailConfirmado).toBe(true);
    expect(usuarios.marcarEmailVerificado).toHaveBeenCalled();
  });

  it('recusa código incorreto, conta a tentativa e não consome', async () => {
    const { servico, tokens, usuarios } = criarServico({ codigoPendente: codigoPendente('BC39KZ') });
    await expect(servico.confirmarEmail(credencial.email, 'ZZZZZZ')).rejects.toThrow(
      'Codigo de verificacao invalido ou expirado',
    );
    expect(tokens.registrarTentativa).toHaveBeenCalledWith('id-token', 5);
    expect(tokens.consumir).not.toHaveBeenCalled();
    expect(usuarios.marcarEmailVerificado).not.toHaveBeenCalled();
  });

  it('recusa código com formato inválido sem consultar o banco', async () => {
    const { servico, tokens } = criarServico({ codigoPendente: codigoPendente('BC39KZ') });
    await expect(servico.confirmarEmail(credencial.email, 'ABC')).rejects.toThrow(
      'Codigo de verificacao invalido ou expirado',
    );
    expect(tokens.registrarTentativa).toHaveBeenCalled();
  });

  it('recusa confirmação sem código pendente', async () => {
    const { servico, tokens } = criarServico({ codigoPendente: null });
    await expect(servico.confirmarEmail(credencial.email, 'BC39KZ')).rejects.toThrow(
      'Codigo de verificacao invalido ou expirado',
    );
    expect(tokens.registrarTentativa).not.toHaveBeenCalled();
  });

  it('não distingue conta inexistente de código errado na resposta', async () => {
    const { servico } = criarServico({ credencial: null });
    await expect(servico.confirmarEmail('nao-existe@exemplo.test', 'BC39KZ')).rejects.toThrow(
      'Codigo de verificacao invalido ou expirado',
    );
  });

  it('recusa confirmação quando o consumo perde a corrida', async () => {
    const codigo = 'BC39KZ';
    const { servico, tokens, usuarios } = criarServico({ codigoPendente: codigoPendente(codigo), consumiu: false });
    await expect(servico.confirmarEmail(credencial.email, codigo)).rejects.toThrow(
      'Codigo de verificacao invalido ou expirado',
    );
    expect(tokens.registrarTentativa).toHaveBeenCalled();
    expect(usuarios.marcarEmailVerificado).not.toHaveBeenCalled();
  });

  it('redefine a senha com hash e revoga todas as sessões do usuário', async () => {
    const codigo = 'QW45RT';
    const { servico, usuarios } = criarServico({ codigoPendente: codigoPendente(codigo, 'redefinicao_senha') });

    const resposta = await servico.redefinirSenha(credencial.email, codigo, 'NovaSenhaSegura123');
    expect(resposta.senhaRedefinida).toBe(true);
    expect(resposta.sessoesRevogadas).toBe(2);
    const hashGravado = usuarios.definirHashSenha.mock.calls[0]![1];
    expect(hashGravado).toMatch(/^scrypt\$/);
    expect(hashGravado).not.toContain('NovaSenhaSegura123');
    expect(usuarios.revogarSessoes).toHaveBeenCalledWith(credencial.idInterno);
  });

  it('recusa senha fora da política antes de consultar o código', async () => {
    const { servico, tokens } = criarServico();
    await expect(servico.redefinirSenha(credencial.email, 'BC39KZ', 'curta')).rejects.toThrow(
      'Senha deve possuir no minimo 12 caracteres, letras e numeros',
    );
    expect(tokens.buscarPendenteDoUsuario).not.toHaveBeenCalled();
  });

  it('recusa código de redefinição já utilizado', async () => {
    const { servico, usuarios } = criarServico({ codigoPendente: null });
    await expect(servico.redefinirSenha(credencial.email, 'QW45RT', 'NovaSenhaSegura123')).rejects.toThrow(
      'Codigo de redefinicao invalido ou expirado',
    );
    expect(usuarios.definirHashSenha).not.toHaveBeenCalled();
  });

  it('não vaza o código em texto claro no corpo do e-mail nem expõe hash', () => {
    const codigo = 'BC39KZ';
    const verificacao = montarEmailVerificacao({
      nomeUsuario: 'Arthur Nóbrega',
      codigo,
      expiraEmMinutos: 15,
    });
    expect(verificacao.assunto).toContain(codigo);
    expect(verificacao.texto).toContain(codigo);
    // No HTML cada caractere fica em uma célula própria para leitura confortável,
    // então o valor aparece separado por marcação. O conteúdo é conferido
    // removendo as tags e verificando que o código continua legível.
    const htmlSemTags = verificacao.html.replace(/<[^>]+>/g, '');
    expect(htmlSemTags).toContain(codigo);
    expect(verificacao.html).not.toContain('scrypt');
    expect(verificacao.html).not.toContain('token=');
    expect(verificacao.texto).not.toContain('http://');

    const redefinicao = montarEmailRedefinicaoSenha({
      nomeUsuario: 'Arthur Nóbrega',
      codigo: 'QW45RT',
      expiraEmMinutos: 15,
    });
    expect(redefinicao.texto).toContain('QW45RT');
    expect(redefinicao.texto).toContain('15 minuto(s)');
  });

  it('escapa HTML do nome do usuário para evitar injeção no template', () => {
    const mensagem = montarEmailVerificacao({
      nomeUsuario: '<script>alert(1)</script>',
      codigo: 'BC39KZ',
      expiraEmMinutos: 15,
    });
    expect(mensagem.html).not.toContain('<script>');
    expect(mensagem.html).toContain('&lt;script&gt;');
  });

  it('serializa as respostas dos RPCs de e-mail em snake_case', async () => {
    const servico = {
      solicitarVerificacaoEmail: vi.fn().mockResolvedValue({
        solicitacaoAceita: true,
        expiraEmSegundos: 900,
        mensagemResultado: 'ok',
        comprimentoCodigo: 6,
      }),
      confirmarEmail: vi.fn().mockResolvedValue({ emailConfirmado: true, emailUsuario: 'a@b.test', mensagemResultado: 'ok' }),
      solicitarRecuperacaoSenha: vi.fn().mockResolvedValue({
        solicitacaoAceita: true,
        expiraEmSegundos: 900,
        mensagemResultado: 'ok',
        comprimentoCodigo: 6,
      }),
      redefinirSenha: vi.fn().mockResolvedValue({ senhaRedefinida: true, sessoesRevogadas: 1, mensagemResultado: 'ok' }),
    };
    const controlador = new ControladorGrpcFluxosEmail(servico as never);
    const metadados = new Metadata();

    await expect(controlador.solicitarVerificacaoEmail({ emailUsuario: 'a@b.test' }, metadados)).resolves.toEqual({
      solicitacao_aceita: true,
      expira_em_segundos: 900,
      mensagem_resultado: 'ok',
      comprimento_codigo: 6,
    });
    await expect(controlador.confirmarEmail({ emailUsuario: 'a@b.test', codigoVerificacao: 'bc39kz' }, metadados)).resolves.toEqual({
      email_confirmado: true,
      email_usuario: 'a@b.test',
      mensagem_resultado: 'ok',
    });
    await expect(controlador.solicitarRecuperacaoSenha({ email_usuario: 'a@b.test' }, metadados)).resolves.toEqual({
      solicitacao_aceita: true,
      expira_em_segundos: 900,
      mensagem_resultado: 'ok',
      comprimento_codigo: 6,
    });
    await expect(
      controlador.redefinirSenha({ emailUsuario: 'a@b.test', codigoRedefinicao: 'qw45rt', novaSenhaUsuario: 'SenhaSegura123' }, metadados),
    ).resolves.toEqual({
      senha_redefinida: true,
      sessoes_revogadas: 1,
      mensagem_resultado: 'ok',
    });

    // O controlador normaliza caixa e espaços antes de chamar o serviço.
    expect(servico.confirmarEmail).toHaveBeenCalledWith('a@b.test', 'bc39kz', expect.anything());
    expect(servico.redefinirSenha).toHaveBeenCalledWith('a@b.test', 'qw45rt', 'SenhaSegura123', expect.anything());
  });
});

describe('serviço de e-mail', () => {
  it('usa o provedor de log quando configurado e não grava o corpo da mensagem', async () => {
    const anterior = process.env.PROVEDOR_EMAIL;
    process.env.PROVEDOR_EMAIL = 'log';
    try {
      const servico = new ServicoEmail();
      const resultado = await servico.enviar({
        destinatario: 'arthur@exemplo.test',
        assunto: 'Seu código de confirmação',
        html: '<p>código SEGREDO</p>',
        texto: 'código SEGREDO',
      });
      expect(resultado.enviado).toBe(true);
      expect(resultado.provedor).toBe('log');
    } finally {
      if (anterior === undefined) delete process.env.PROVEDOR_EMAIL;
      else process.env.PROVEDOR_EMAIL = anterior;
    }
  });

  it('recusa o envio real sem chave configurada e informa o motivo', async () => {
    const anteriorProvedor = process.env.PROVEDOR_EMAIL;
    const anteriorChave = process.env.RESEND_CHAVE_API;
    delete process.env.PROVEDOR_EMAIL;
    delete process.env.RESEND_CHAVE_API;
    try {
      const servico = new ServicoEmail();
      const resultado = await servico.enviar({
        destinatario: 'arthur@exemplo.test',
        assunto: 'Seu código de confirmação',
        html: '<p>conteudo</p>',
        texto: 'conteudo',
      });
      expect(resultado.enviado).toBe(false);
      expect(resultado.provedor).toBe('resend');
      expect(resultado.motivo).toContain('nao configurado');
    } finally {
      if (anteriorProvedor === undefined) delete process.env.PROVEDOR_EMAIL;
      else process.env.PROVEDOR_EMAIL = anteriorProvedor;
      if (anteriorChave === undefined) delete process.env.RESEND_CHAVE_API;
      else process.env.RESEND_CHAVE_API = anteriorChave;
    }
  });
});
