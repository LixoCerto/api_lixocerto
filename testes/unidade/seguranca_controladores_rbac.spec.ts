import { ForbiddenException } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { describe, expect, it, vi } from 'vitest';
import { ServicoAutorizacao } from '../../src/modulos/autorizacao/autorizacao.servico.js';
import { ControladorGrpcAvaliacaoUsabilidade } from '../../src/modulos/avaliacao_usabilidade/avaliacao_usabilidade.controlador.grpc.js';
import { ControladorGrpcGamificacao } from '../../src/modulos/gamificacao/gamificacao.controlador.grpc.js';
import { ControladorGrpcDesafios } from '../../src/modulos/desafios/desafios.controlador.grpc.js';
import { ControladorGrpcPontosColeta } from '../../src/modulos/pontos_coleta/pontos_coleta.controlador.grpc.js';

const identidadeSemAcesso = {
  idExterno: 'local:usuario-sem-acesso',
  nome: 'Usuário sem acesso',
  email: 'sem-acesso@exemplo.test',
  papeis: ['usuario'],
  permissoes: [] as string[],
};

function metadadosAutenticados() {
  const metadados = new Metadata();
  metadados.set('authorization', 'Bearer token-teste');
  return metadados;
}

function autenticacao(identidade: typeof identidadeSemAcesso) {
  return { obterIdentidadeAtual: vi.fn().mockResolvedValue(identidade) };
}

describe('autorização dos controladores gRPC', () => {
  it('nega listagem e obtenção de pontos sem pontos_coleta:ler antes de consultar o repositório', async () => {
    const servico = { listar: vi.fn(), obter: vi.fn() };
    const controlador = new ControladorGrpcPontosColeta(
      servico as never,
      autenticacao(identidadeSemAcesso) as never,
      new ServicoAutorizacao(),
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const metadados = metadadosAutenticados();

    await expect(controlador.listarPontosColeta({}, metadados)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controlador.obterPontoColeta({ id_ponto_coleta: 'ponto-alvo' }, metadados)).rejects.toBeInstanceOf(ForbiddenException);
    expect(servico.listar).not.toHaveBeenCalled();
    expect(servico.obter).not.toHaveBeenCalled();
  });

  it('mantém o filtro Todos da fila de descartes para revisores autorizados', async () => {
    const identidade = { ...identidadeSemAcesso, permissoes: ['pontos_coleta:aprovar'] };
    const descartes = { listarGestao: vi.fn().mockResolvedValue([]) };
    const usuarios = { obterIdInterno: vi.fn().mockResolvedValue('id-revisor') };
    const controlador = new ControladorGrpcPontosColeta(
      {} as never,
      autenticacao(identidade) as never,
      new ServicoAutorizacao(),
      usuarios as never,
      {} as never,
      {} as never,
      descartes as never,
    );

    await expect(controlador.listarDescartesGestao({ status: 'todos' }, metadadosAutenticados())).resolves.toEqual({ registros: [] });
    expect(descartes.listarGestao).toHaveBeenCalledWith('todos');
  });

  it('exige leitura e participação para check-in e protege a leitura de evidências', async () => {
    const identidade = { ...identidadeSemAcesso, permissoes: ['pontos_coleta:ler'] };
    const usuarios = { obterIdInterno: vi.fn() };
    const descartes = { iniciarCheckin: vi.fn(), concluir: vi.fn(), obterEvidencia: vi.fn() };
    const controlador = new ControladorGrpcPontosColeta(
      {} as never,
      autenticacao(identidade) as never,
      new ServicoAutorizacao(),
      usuarios as never,
      {} as never,
      {} as never,
      descartes as never,
    );
    const metadados = metadadosAutenticados();

    await expect(controlador.iniciarCheckinDescarte({ id_ponto_coleta: 'ponto-1' }, metadados)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controlador.concluirDescarte({ id_checkin: 'checkin-1' }, metadados)).rejects.toBeInstanceOf(ForbiddenException);
    expect(usuarios.obterIdInterno).not.toHaveBeenCalled();
    expect(descartes.iniciarCheckin).not.toHaveBeenCalled();
    expect(descartes.concluir).not.toHaveBeenCalled();

    const identidadeSomenteGamificacao = { ...identidadeSemAcesso, permissoes: ['gamificacao:ler'] };
    const controladorSemPontos = new ControladorGrpcPontosColeta(
      {} as never,
      autenticacao(identidadeSomenteGamificacao) as never,
      new ServicoAutorizacao(),
      usuarios as never,
      {} as never,
      {} as never,
      descartes as never,
    );
    await expect(controladorSemPontos.obterEvidenciaDescarte({ id_registro: 'registro-1' }, metadados)).rejects.toBeInstanceOf(ForbiddenException);
    expect(descartes.obterEvidencia).not.toHaveBeenCalled();
  });

  it('deriva o progresso gamificado do bearer autenticado e ignora x-id-usuario-externo fornecido pelo cliente', async () => {
    const identidade = { ...identidadeSemAcesso, permissoes: ['gamificacao:ler'] };
    const servico = {
      obterProgresso: vi.fn().mockResolvedValue({ quantidadePontos: 120, nivelGamificacao: 'iniciante', sequenciaDias: 2, quantidadeConquistas: 1, selos: [], pontosPorOrigem: [] }),
      obterRanking: vi.fn().mockResolvedValue([]),
    };
    const usuarios = { obterIdInterno: vi.fn().mockResolvedValue('id-interno-proprio') };
    const controlador = new ControladorGrpcGamificacao(servico as never, autenticacao(identidade) as never, new ServicoAutorizacao(), usuarios as never);
    const metadados = metadadosAutenticados();
    metadados.set('x-id-usuario-externo', 'local:vitima');

    await expect(controlador.obterProgressoUsuario({}, metadados)).resolves.toMatchObject({ quantidade_pontos: 120 });
    expect(usuarios.obterIdInterno).toHaveBeenCalledWith(identidade.idExterno);
    expect(servico.obterProgresso).toHaveBeenCalledWith('id-interno-proprio');
  });

  it('nega progresso e ranking gamificados para quem não tem gamificacao:ler', async () => {
    const servico = { obterProgresso: vi.fn(), obterRanking: vi.fn() };
    const controlador = new ControladorGrpcGamificacao(servico as never, autenticacao(identidadeSemAcesso) as never, new ServicoAutorizacao(), { obterIdInterno: vi.fn() } as never);
    const metadados = metadadosAutenticados();

    await expect(controlador.obterProgressoUsuario({}, metadados)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controlador.obterRanking({ limite_resultado: 10 }, metadados)).rejects.toBeInstanceOf(ForbiddenException);
    expect(servico.obterProgresso).not.toHaveBeenCalled();
    expect(servico.obterRanking).not.toHaveBeenCalled();
  });

  it('nega o envio SUS quando o papel não tem avaliacao_usabilidade:enviar', async () => {
    const servico = { enviar: vi.fn() };
    const controlador = new ControladorGrpcAvaliacaoUsabilidade(servico as never, autenticacao(identidadeSemAcesso) as never, new ServicoAutorizacao());

    await expect(controlador.enviarAvaliacaoSus({ codigo_participante: 'codigo-forjado', indica_consentimento: true, notas_itens: Array(10).fill(3) }, metadadosAutenticados())).rejects.toBeInstanceOf(ForbiddenException);
    expect(servico.enviar).not.toHaveBeenCalled();
  });

  it('não permite participar de desafio com gamificacao:ler sem gamificacao:participar', async () => {
    const identidade = { ...identidadeSemAcesso, permissoes: ['gamificacao:ler'] };
    const servico = { participar: vi.fn(), registrarAcao: vi.fn() };
    const controlador = new ControladorGrpcDesafios(
      servico as never,
      autenticacao(identidade) as never,
      new ServicoAutorizacao(),
      { obterIdInterno: vi.fn().mockResolvedValue('id-usuario') } as never,
      {} as never,
      {} as never,
    );

    await expect(controlador.participarDesafio({ id_desafio: 'desafio-1' }, metadadosAutenticados())).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controlador.registrarAcaoSustentavel({ id_desafio: 'desafio-1' }, metadadosAutenticados())).rejects.toBeInstanceOf(ForbiddenException);
    expect(servico.participar).not.toHaveBeenCalled();
    expect(servico.registrarAcao).not.toHaveBeenCalled();
  });
});
