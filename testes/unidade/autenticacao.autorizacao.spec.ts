import { describe, expect, it } from 'vitest';
import { UsuarioAutenticado } from '../../src/comum/autenticacao/usuario_autenticado.js';
import { ServicoAutorizacao } from '../../src/modulos/autorizacao/autorizacao.servico.js';
import { criarHashSenha, senhaValida, verificarSenha } from '../../src/modulos/autenticacao/senha.util.js';
import { VerificadorJwtServico } from '../../src/modulos/autenticacao/verificador_jwt.servico.js';

const usuario: UsuarioAutenticado = {
  idExterno: 'local:usuario-1',
  nome: 'Arthur',
  email: 'arthur@exemplo.test',
  papeis: ['usuario'],
  permissoes: ['materiais:ler'],
  emailVerificado: true,
};

describe('autenticacao e autorizacao', () => {
  it('extrai somente tokens Bearer validos', () => {
    const verificador = new VerificadorJwtServico();
    expect(verificador.extrairToken('Bearer token-de-teste')).toBe('token-de-teste');
    expect(() => verificador.extrairToken(undefined)).toThrow('Cabecalho de autorizacao ausente');
  });

  it('separa permissao explicita de papel administrativo', () => {
    const autorizacao = new ServicoAutorizacao();
    expect(autorizacao.temPermissao(usuario, 'materiais:ler')).toBe(true);
    expect(autorizacao.temPermissao(usuario, 'materiais:escrever')).toBe(false);
    expect(autorizacao.temPermissao({ ...usuario, papeis: ['administrador'], permissoes: [] }, 'auditoria:consultar')).toBe(true);
  });

  it('cria e verifica hash de senha sem armazenar a senha original', async () => {
    const senha = 'SenhaSegura123';
    const hash = await criarHashSenha(senha);
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain(senha);
    expect(await verificarSenha(senha, hash)).toBe(true);
    expect(await verificarSenha('SenhaErrada123', hash)).toBe(false);
  });

  it('aplica a política mínima de senha', () => {
    expect(senhaValida('SenhaSegura123')).toBe(true);
    expect(senhaValida('curta1')).toBe(false);
    expect(senhaValida('somenteletras')).toBe(false);
  });

  it('assina e valida JWT local sem depender de emissor externo', async () => {
    const segredoAnterior = process.env.SEGREDO_JWT;
    process.env.SEGREDO_JWT = 'segredo-jwt-de-teste-com-mais-de-32-caracteres';
    try {
      const verificador = new VerificadorJwtServico();
      const token = await verificador.assinarTokenAcesso(usuario);
      await expect(verificador.verificar(token)).resolves.toMatchObject({
        idExterno: usuario.idExterno,
        email: usuario.email,
        papeis: usuario.papeis,
      });
    } finally {
      if (segredoAnterior === undefined) delete process.env.SEGREDO_JWT;
      else process.env.SEGREDO_JWT = segredoAnterior;
    }
  });
});
