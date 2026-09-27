import { Metadata } from '@grpc/grpc-js';
import { describe, expect, it, vi } from 'vitest';
import { montarEmailRedefinicaoSenha, montarEmailVerificacao } from '../../src/infraestrutura/email/templates_email.js';
import { ServicoEmail } from '../../src/infraestrutura/email/email.servico.js';
import { ControladorGrpcFluxosEmail } from '../../src/modulos/autenticacao/fluxos_email.controlador.grpc.js';
import { ServicoFluxosEmail } from '../../src/modulos/autenticacao/fluxos_email.servico.js';
import { gerarTokenUsoUnico, hashTokenUsoUnico, tokenUsoUnicoValido } from '../../src/modulos/autenticacao/token_uso_unico.util.js';

const credencial = {
  idInterno: 'uuid-usuario-interno',
  idExterno: 'local:usuario-1',
  nome: 'Arthur Nóbrega',
  email: 'arthur@exemplo.test',
  hashSenha: 'scrypt$...',
  status: 'ativo' as const,
};

function criarServico(opcoes: {
  credencial?: typeof credencial | null;
  tokenEncontrado?: {
    idToken: string;
    idUsuario: string;
    tipo: 'verificacao_email' | 'redefinicao_senha';
    dataExpiracao: Date;
    quantidadeTentativas: number;
    consumido: boolean;
    expirado: boolean;
  } | null;
  consumiu?: boolean;
  envioEnviado?: boolean;
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
    buscarPorHash: vi.fn().mockResolvedValue(opcoes.tokenEncontrado ?? null),
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

describe('fluxos de e-mail da autenticação', () => {
  it('gera token opaco, válido para transporte e nunca persistido em texto claro', () => {
    const token = gerarTokenUsoUnico();
    const hash = hashTokenUsoUnico(token);
    expect(tokenUsoUnicoValido(token)).toBe(true);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
    expect(hashTokenUsoUnico(token)).toBe(hash);
  });

  it('recusa token malformado sem consultar o banco', () => {
    expect(tokenUsoUnicoValido('curto')).toBe(false);
    expect(tokenUsoUnicoValido('a'.repeat(200))).toBe(false);
  });

  it('solicita verificação de e-mail e envia link com token de uso único', async () => {
    const { servico, tokens, email } = criarServico();
    const resposta = await servico.solicitarVerificacaoEmail('Arthur@Exemplo.Test', { enderecoIp: '127.0.0.1' });

    expect(resposta.solicitacaoAceita).toBe(true);
    expect(resposta.expiraEmSegundos).toBe(24 * 3600);
    expect(tokens.criar).toHaveBeenCalledOnce();
    const criado = tokens.criar.mock.calls[0]![0]!;
    expect(criado.tipo).toBe('verificacao_email');
    expect(criado.hashToken).toHaveLength(64);
    expect(email.enviar).toHaveBeenCalledOnce();
    expect(email.enviar.mock.calls[0]![0]!.destinatario).toBe('arthur@exemplo.test');
  });

  it('responde de forma neutra quando o e-mail não existe, sem criar token', async () => {
    const { servico, tokens, email } = criarServico({ credencial: null });
    const resposta = await servico.solicitarVerificacaoEmail('inexistente@exemplo.test');

    expect(resposta.solicitacaoAceita).toBe(true);
    expect(resposta.mensagemResultado).toContain('Se o endereco informado estiver cadastrado');
    expect(tokens.criar).not.toHaveBeenCalled();
    expect(email.enviar).not.toHaveBeenCalled();
  });

  it('invalida o token quando o provedor de e-mail falha no envio', async () => {
    const { servico, tokens } = criarServico({ envioEnviado: false });
    await expect(servico.solicitarVerificacaoEmail('arthur@exemplo.test')).rejects.toThrow(
      'Nao foi possivel enviar o email de confirmacao',
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

  it('confirma o e-mail consumindo o token uma única vez', async () => {
    const token = gerarTokenUsoUnico();
    const { servico, tokens, usuarios } = criarServico({
      tokenEncontrado: {
        idToken: 'id-token',
        idUsuario: credencial.idInterno,
        tipo: 'verificacao_email',
        dataExpiracao: new Date(Date.now() + 60_000),
        quantidadeTentativas: 0,
        consumido: false,
        expirado: false,
      },
    });

    const resposta = await servico.confirmarEmail(token);
    expect(resposta.emailConfirmado).toBe(true);
    expect(resposta.emailUsuario).toBe(credencial.email);
    expect(tokens.buscarPorHash).toHaveBeenCalledWith(hashTokenUsoUnico(token), 'verificacao_email');
    expect(tokens.consumir).toHaveBeenCalledWith('id-token');
    expect(usuarios.marcarEmailVerificado).toHaveBeenCalledWith(credencial.idInterno);
  });

  it('recusa token já utilizado e registra tentativa', async () => {
    const { servico, tokens } = criarServico({
      tokenEncontrado: {
        idToken: 'id-token',
        idUsuario: credencial.idInterno,
        tipo: 'verificacao_email',
        dataExpiracao: new Date(Date.now() + 60_000),
        quantidadeTentativas: 0,
        consumido: true,
        expirado: false,
      },
    });
    await expect(servico.confirmarEmail(gerarTokenUsoUnico())).rejects.toThrow('Token de verificacao invalido ou expirado');
    expect(tokens.registrarTentativa).toHaveBeenCalled();
    expect(tokens.consumir).not.toHaveBeenCalled();
  });

  it('recusa token expirado', async () => {
    const { servico } = criarServico({
      tokenEncontrado: {
        idToken: 'id-token',
        idUsuario: credencial.idInterno,
        tipo: 'redefinicao_senha',
        dataExpiracao: new Date(Date.now() - 1000),
        quantidadeTentativas: 0,
        consumido: false,
        expirado: true,
      },
    });
    await expect(servico.redefinirSenha(gerarTokenUsoUnico(), 'NovaSenhaSegura123')).rejects.toThrow(
      'Token de redefinicao invalido ou expirado',
    );
  });

  it('redefine a senha com hash e revoga todas as sessões do usuário', async () => {
    const { servico, usuarios } = criarServico({
      tokenEncontrado: {
        idToken: 'id-token',
        idUsuario: credencial.idInterno,
        tipo: 'redefinicao_senha',
        dataExpiracao: new Date(Date.now() + 60_000),
        quantidadeTentativas: 0,
        consumido: false,
        expirado: false,
      },
    });

    const resposta = await servico.redefinirSenha(gerarTokenUsoUnico(), 'NovaSenhaSegura123');
    expect(resposta.senhaRedefinida).toBe(true);
    expect(resposta.sessoesRevogadas).toBe(2);
    const hashGravado = usuarios.definirHashSenha.mock.calls[0]![1];
    expect(hashGravado).toMatch(/^scrypt\$/);
    expect(hashGravado).not.toContain('NovaSenhaSegura123');
    expect(usuarios.revogarSessoes).toHaveBeenCalledWith(credencial.idInterno);
  });

  it('recusa senha fora da política antes de consultar o token', async () => {
    const { servico, tokens } = criarServico();
    await expect(servico.redefinirSenha(gerarTokenUsoUnico(), 'curta')).rejects.toThrow(
      'Senha deve possuir no minimo 12 caracteres, letras e numeros',
    );
    expect(tokens.buscarPorHash).not.toHaveBeenCalled();
  });

  it('não vaza token nem link completo nos templates e mensagens', () => {
    const verificacao = montarEmailVerificacao({
      nomeUsuario: 'Arthur Nóbrega',
      urlConfirmacao: 'http://localhost:3000/confirmar-email?token=SEGREDO_DE_TESTE',
      expiraEmHoras: 24,
    });
    expect(verificacao.assunto).toBe('Confirme seu e-mail no Lixo Certo');
    expect(verificacao.html).toContain('SEGREDO_DE_TESTE');
    expect(verificacao.texto).toContain('http://localhost:3000/confirmar-email?token=SEGREDO_DE_TESTE');
    expect(verificacao.html).not.toContain('scrypt');

    const redefinicao = montarEmailRedefinicaoSenha({
      nomeUsuario: 'Arthur Nóbrega',
      urlRedefinicao: 'https://app.exemplo.test/redefinir-senha?token=OUTRO_SEGREDO',
      expiraEmMinutos: 60,
    });
    expect(redefinicao.assunto).toBe('Redefinição de senha do Lixo Certo');
    expect(redefinicao.texto).toContain('OUTRO_SEGREDO');
  });

  it('escapa HTML do nome do usuário para evitar injeção no template', () => {
    const mensagem = montarEmailVerificacao({
      nomeUsuario: '<script>alert(1)</script>',
      urlConfirmacao: 'https://app.exemplo.test/confirmar-email?token=abc',
      expiraEmHoras: 1,
    });
    expect(mensagem.html).not.toContain('<script>');
    expect(mensagem.html).toContain('&lt;script&gt;');
  });

  it('serializa as respostas dos novos RPCs em snake_case', async () => {
    const servico = {
      solicitarVerificacaoEmail: vi.fn().mockResolvedValue({ solicitacaoAceita: true, expiraEmSegundos: 3600, mensagemResultado: 'ok' }),
      confirmarEmail: vi.fn().mockResolvedValue({ emailConfirmado: true, emailUsuario: 'a@b.test', mensagemResultado: 'ok' }),
      solicitarRecuperacaoSenha: vi.fn().mockResolvedValue({ solicitacaoAceita: true, expiraEmSegundos: 3600, mensagemResultado: 'ok' }),
      redefinirSenha: vi.fn().mockResolvedValue({ senhaRedefinida: true, sessoesRevogadas: 1, mensagemResultado: 'ok' }),
    };
    const controlador = new ControladorGrpcFluxosEmail(servico as never);
    const metadados = new Metadata();

    await expect(controlador.solicitarVerificacaoEmail({ emailUsuario: 'a@b.test' }, metadados)).resolves.toEqual({
      solicitacao_aceita: true,
      expira_em_segundos: 3600,
      mensagem_resultado: 'ok',
    });
    await expect(controlador.confirmarEmail({ tokenVerificacao: 'token' }, metadados)).resolves.toEqual({
      email_confirmado: true,
      email_usuario: 'a@b.test',
      mensagem_resultado: 'ok',
    });
    await expect(controlador.solicitarRecuperacaoSenha({ email_usuario: 'a@b.test' }, metadados)).resolves.toEqual({
      solicitacao_aceita: true,
      expira_em_segundos: 3600,
      mensagem_resultado: 'ok',
    });
    await expect(controlador.redefinirSenha({ tokenRedefinicao: 'token', novaSenhaUsuario: 'SenhaSegura123' }, metadados)).resolves.toEqual({
      senha_redefinida: true,
      sessoes_revogadas: 1,
      mensagem_resultado: 'ok',
    });
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
        assunto: 'Confirme seu e-mail',
        html: '<p>token SEGREDO</p>',
        texto: 'token SEGREDO',
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
        assunto: 'Confirme seu e-mail',
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
