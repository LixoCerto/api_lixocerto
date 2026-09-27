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
});
