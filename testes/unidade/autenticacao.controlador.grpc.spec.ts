import { Metadata } from '@grpc/grpc-js';
import { describe, expect, it, vi } from 'vitest';
import { ControladorGrpcAutenticacao } from '../../src/modulos/autenticacao/autenticacao.controlador.grpc.js';

const identidade = {
  idExterno: 'local:usuario-teste',
  nome: 'Usuario Postman',
  email: 'usuario@exemplo.test',
  papeis: ['usuario'],
  permissoes: ['materiais:ler'],
};

const resposta = {
  tokenAcesso: 'token-acesso-teste',
  tokenAtualizacao: 'token-atualizacao-teste',
  expiraEmSegundos: 900,
  identidade,
};

describe('controlador gRPC de autenticacao', () => {
  it('aceita o mapeamento camelCase produzido por clientes protobuf', async () => {
    const servico = {
      cadastrarUsuario: vi.fn().mockResolvedValue(resposta),
    };
    const controlador = new ControladorGrpcAutenticacao(servico as never);

    const retorno = await controlador.cadastrarUsuario({
      nomeUsuario: 'Usuario Postman',
      emailUsuario: 'usuario@exemplo.test',
      senhaUsuario: 'SenhaPostman123',
    }, new Metadata());

    expect(servico.cadastrarUsuario).toHaveBeenCalledWith(
      'Usuario Postman',
      'usuario@exemplo.test',
      'SenhaPostman123',
      expect.any(Object),
    );
    expect(retorno).toMatchObject({
      token_acesso: 'token-acesso-teste',
      token_atualizacao: 'token-atualizacao-teste',
      identidade: { nome_usuario: 'Usuario Postman' },
    });
  });

  it('grava um único IP válido ao receber a cadeia encaminhada por Cloudflare e Docker', async () => {
    const servico = {
      entrar: vi.fn().mockResolvedValue(resposta),
    };
    const controlador = new ControladorGrpcAutenticacao(servico as never);
    const metadados = new Metadata();
    metadados.set('cf-connecting-ip', '198.51.100.42');
    metadados.set('x-forwarded-for', '172.70.193.152, 172.18.0.1');

    await controlador.entrar({
      email_usuario: 'usuario@exemplo.test',
      senha_usuario: 'SenhaPostman123',
    }, metadados);

    expect(servico.entrar).toHaveBeenCalledWith(
      'usuario@exemplo.test',
      'SenhaPostman123',
      expect.objectContaining({ enderecoIp: '198.51.100.42' }),
    );
  });

  it('encaminha o ID token Google, o nonce e o contexto da sessão', async () => {
    const servico = {
      entrarComGoogle: vi.fn().mockResolvedValue(resposta),
    };
    const controlador = new ControladorGrpcAutenticacao(servico as never);
    const metadados = new Metadata();
    metadados.set('cf-connecting-ip', '198.51.100.42');

    const retorno = await controlador.entrarComGoogle({
      idToken: 'jwt-google-de-teste',
      nonce: 'nonce-google-de-teste',
    }, metadados);

    expect(servico.entrarComGoogle).toHaveBeenCalledWith(
      'jwt-google-de-teste',
      'nonce-google-de-teste',
      expect.objectContaining({ enderecoIp: '198.51.100.42' }),
    );
    expect(retorno).toMatchObject({
      token_acesso: 'token-acesso-teste',
      identidade: { nome_usuario: 'Usuario Postman' },
    });
  });
});
