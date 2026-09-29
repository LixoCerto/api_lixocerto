import { Metadata } from '@grpc/grpc-js';
import { describe, expect, it, vi } from 'vitest';
import { ControladorGrpcAdministracao } from '../../src/modulos/administracao/administracao.controlador.grpc.js';

function prepararControlador() {
  const servico = {
    obterResumo: vi.fn(),
    listarUsuarios: vi.fn(),
    listarPapeis: vi.fn(),
    listarPermissoes: vi.fn(),
    criarPapel: vi.fn(),
    atualizarPapel: vi.fn(),
    arquivarPapel: vi.fn(),
    restaurarPapel: vi.fn(),
    definirPermissoesPapel: vi.fn(),
    alterarStatusUsuario: vi.fn(),
    definirPapeisUsuario: vi.fn(),
    revogarSessoesUsuario: vi.fn(),
  };
  const autenticacao = { obterIdentidadeAtual: vi.fn().mockResolvedValue({ idExterno: 'oidc|admin-1' }) };
  const autorizacao = { exigirPermissao: vi.fn() };
  const usuarios = { obterIdInterno: vi.fn().mockResolvedValue('usuario-interno-1') };
  const controlador = new ControladorGrpcAdministracao(
    servico as never,
    autenticacao as never,
    autorizacao as never,
    usuarios as never,
  );
  const metadados = new Metadata();
  metadados.set('authorization', 'Bearer token-de-teste');
  metadados.set('x-correlation-id', 'correlacao-teste');
  return { controlador, servico, autenticacao, autorizacao, usuarios, metadados };
}

describe('ControladorGrpcAdministracao', () => {
  it('exige autorização antes de consultar usuários', async () => {
    const { controlador, servico, autorizacao, metadados } = prepararControlador();
    const erro = new Error('sem permissão');
    autorizacao.exigirPermissao.mockImplementation(() => { throw erro; });

    await expect(controlador.listarUsuariosAdministrativos({ busca: 'ana' }, metadados)).rejects.toBe(erro);
    expect(autorizacao.exigirPermissao).toHaveBeenCalledWith({ idExterno: 'oidc|admin-1' }, 'administracao:gerenciar_acessos');
    expect(servico.listarUsuarios).not.toHaveBeenCalled();
  });

  it('repassa paginação e filtros e serializa os usuários para gRPC', async () => {
    const { controlador, servico, autorizacao, metadados } = prepararControlador();
    servico.listarUsuarios.mockResolvedValue({
      usuarios: [{
        idUsuario: 'usuario-1', nomeUsuario: 'Ana', emailUsuario: 'ana@example.test', statusUsuario: 'ativo',
        emailVerificado: true, dataCriacao: '2026-09-01T00:00:00.000Z', dataUltimoAcesso: '',
        papeis: [{ idPapel: 'papel-1', nomePapel: 'revisor', statusPapel: 'ativo' }],
      }],
      total: 1,
    });

    const resposta = await controlador.listarUsuariosAdministrativos({ busca: 'ana', status: 'ativo', deslocamento: 20, limite: 20 }, metadados);

    expect(autorizacao.exigirPermissao).toHaveBeenCalledWith({ idExterno: 'oidc|admin-1' }, 'administracao:gerenciar_acessos');
    expect(servico.listarUsuarios).toHaveBeenCalledWith({ busca: 'ana', status: 'ativo', deslocamento: 20, limite: 20 });
    expect(resposta).toEqual({
      usuarios: [{
        id_usuario: 'usuario-1', nome_usuario: 'Ana', email_usuario: 'ana@example.test', status_usuario: 'ativo',
        email_verificado: true, data_criacao: '2026-09-01T00:00:00.000Z', data_ultimo_acesso: '',
        papeis: [{ id_papel: 'papel-1', nome_papel: 'revisor', status_papel: 'ativo' }],
      }],
      total: 1,
    });
  });

  it('envia matriz e justificativa na mesma atualização transacional do papel', async () => {
    const { controlador, servico, metadados } = prepararControlador();
    const requisicao = {
      id_papel: 'papel-custom',
      nome_papel: 'moderador_local',
      descricao_papel: 'Moderação local de conteúdo',
      ids_permissoes: ['permissao-1'],
      motivo: 'Ajuste para o escopo local',
    };

    const resposta = await controlador.atualizarPapelAdministrativo(requisicao, metadados);

    expect(servico.atualizarPapel).toHaveBeenCalledWith('papel-custom', {
      nome: 'moderador_local',
      descricao: 'Moderação local de conteúdo',
      idsPermissoes: ['permissao-1'],
      motivo: 'Ajuste para o escopo local',
    }, 'usuario-interno-1', 'correlacao-teste');
    expect(resposta.operacao_aceita).toBe(true);
  });
});
