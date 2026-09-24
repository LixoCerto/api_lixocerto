import { describe, expect, it } from 'vitest';
import { UsuarioAutenticado } from '../../src/comum/autenticacao/usuario_autenticado.js';
import { ServicoAutorizacao } from '../../src/modulos/autorizacao/autorizacao.servico.js';
import { VerificadorJwtServico } from '../../src/modulos/autenticacao/verificador_jwt.servico.js';

const usuario: UsuarioAutenticado = {
  idExterno: 'usuario-1',
  nome: 'Arthur',
  email: 'arthur@exemplo.test',
  papeis: ['usuario'],
  permissoes: ['materiais:ler'],
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
});
