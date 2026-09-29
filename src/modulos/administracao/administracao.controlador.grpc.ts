import { Controller } from '@nestjs/common';
import { Metadata, status } from '@grpc/grpc-js';
import { GrpcMethod } from '@nestjs/microservices';
import { RpcException } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { ServicoAutenticacao } from '../autenticacao/autenticacao.servico.js';
import { ServicoAutorizacao } from '../autorizacao/autorizacao.servico.js';
import { ServicoUsuarios } from '../usuarios/usuarios.servico.js';
import { ServicoAdministracao } from './administracao.servico.js';

function valorTexto(metadados: Metadata, chave: string): string | undefined {
  const valor = metadados.get(chave)[0];
  return Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
}

@Controller()
export class ControladorGrpcAdministracao {
  constructor(
    private readonly servico: ServicoAdministracao,
    private readonly autenticacao: ServicoAutenticacao,
    private readonly autorizacao: ServicoAutorizacao,
    private readonly usuarios: ServicoUsuarios,
  ) {}

  private async obterContexto(metadados: Metadata, permissao: string) {
    const identidade = await this.autenticacao.obterIdentidadeAtual(valorTexto(metadados, 'authorization'));
    this.autorizacao.exigirPermissao(identidade, permissao);
    const idUsuario = await this.usuarios.obterIdInterno(identidade.idExterno);
    if (!idUsuario) throw new RpcException({ code: status.UNAUTHENTICATED, message: 'Identidade administrativa sem usuário interno.' });
    return { identidade, idUsuario, correlacao: valorTexto(metadados, 'x-correlation-id') ?? randomUUID() };
  }

  @GrpcMethod('ServicoAdministracao', 'ObterResumoAdministrativo')
  async obterResumoAdministrativo(_requisicao: unknown, metadados: Metadata) {
    await this.obterContexto(metadados, 'administracao:consultar');
    const resumo = await this.servico.obterResumo();
    return {
      quantidade_usuarios: resumo.quantidadeUsuarios,
      quantidade_materiais: resumo.quantidadeMateriais,
      quantidade_pontos_pendentes: resumo.quantidadePontosPendentes,
      quantidade_avaliacoes: resumo.quantidadeAvaliacoes,
      quantidade_papeis: resumo.quantidadePapeis,
      quantidade_eventos_auditoria: resumo.quantidadeAuditorias,
      quantidade_materiais_publicados: resumo.quantidadeMateriaisPublicados,
    };
  }

  @GrpcMethod('ServicoAdministracao', 'ListarUsuariosAdministrativos')
  async listarUsuariosAdministrativos(requisicao: { busca?: string; status?: string; deslocamento?: number; limite?: number }, metadados: Metadata) {
    await this.obterContexto(metadados, 'administracao:gerenciar_acessos');
    const resultado = await this.servico.listarUsuarios({
      busca: requisicao.busca,
      status: requisicao.status,
      deslocamento: requisicao.deslocamento,
      limite: requisicao.limite,
    });
    return {
      usuarios: resultado.usuarios.map((usuario) => ({
        id_usuario: usuario.idUsuario,
        nome_usuario: usuario.nomeUsuario,
        email_usuario: usuario.emailUsuario,
        status_usuario: usuario.statusUsuario,
        email_verificado: usuario.emailVerificado,
        data_criacao: usuario.dataCriacao,
        data_ultimo_acesso: usuario.dataUltimoAcesso,
        papeis: usuario.papeis.map((papel) => ({
          id_papel: papel.idPapel,
          nome_papel: papel.nomePapel,
          status_papel: papel.statusPapel,
        })),
      })),
      total: resultado.total,
    };
  }

  @GrpcMethod('ServicoAdministracao', 'AlterarStatusUsuarioAdministrativo')
  async alterarStatusUsuarioAdministrativo(requisicao: { id_usuario?: string; status?: string; motivo?: string }, metadados: Metadata) {
    const contexto = await this.obterContexto(metadados, 'administracao:gerenciar_acessos');
    const sessoesRevogadas = await this.servico.alterarStatusUsuario(
      requisicao.id_usuario ?? '', requisicao.status ?? '', requisicao.motivo ?? '', contexto.idUsuario, contexto.correlacao,
    );
    return { operacao_aceita: true, sessoes_revogadas: sessoesRevogadas, mensagem_resultado: 'Status atualizado.' };
  }

  @GrpcMethod('ServicoAdministracao', 'DefinirPapeisUsuarioAdministrativo')
  async definirPapeisUsuarioAdministrativo(requisicao: { id_usuario?: string; ids_papeis?: string[]; motivo?: string }, metadados: Metadata) {
    const contexto = await this.obterContexto(metadados, 'administracao:gerenciar_acessos');
    await this.servico.definirPapeisUsuario(
      requisicao.id_usuario ?? '', requisicao.ids_papeis ?? [], requisicao.motivo ?? '', contexto.idUsuario, contexto.correlacao,
    );
    return { operacao_aceita: true, mensagem_resultado: 'Papéis atualizados; sessões anteriores foram encerradas.' };
  }

  @GrpcMethod('ServicoAdministracao', 'RevogarSessoesUsuarioAdministrativo')
  async revogarSessoesUsuarioAdministrativo(requisicao: { id_usuario?: string; motivo?: string }, metadados: Metadata) {
    const contexto = await this.obterContexto(metadados, 'administracao:gerenciar_acessos');
    const quantidade = await this.servico.revogarSessoesUsuario(
      requisicao.id_usuario ?? '', requisicao.motivo ?? '', contexto.idUsuario, contexto.correlacao,
    );
    return { quantidade_revogada: quantidade, mensagem_resultado: 'Sessões revogadas.' };
  }

  @GrpcMethod('ServicoAdministracao', 'ListarPapeisAdministrativos')
  async listarPapeisAdministrativos(requisicao: { incluir_inativos?: boolean }, metadados: Metadata) {
    await this.obterContexto(metadados, 'administracao:gerenciar_acessos');
    const papeis = await this.servico.listarPapeis(Boolean(requisicao.incluir_inativos));
    return { papeis: papeis.map((papel) => ({
      id_papel: papel.idPapel,
      nome_papel: papel.nomePapel,
      descricao_papel: papel.descricaoPapel,
      status_papel: papel.statusPapel,
      papel_sistema: papel.papelSistema,
      quantidade_usuarios: papel.quantidadeUsuarios,
      ids_permissoes: papel.idsPermissoes,
      codigos_permissoes: papel.codigosPermissoes,
    })) };
  }

  @GrpcMethod('ServicoAdministracao', 'ListarPermissoesAdministrativas')
  async listarPermissoesAdministrativas(_requisicao: unknown, metadados: Metadata) {
    await this.obterContexto(metadados, 'administracao:gerenciar_acessos');
    const permissoes = await this.servico.listarPermissoes();
    return { permissoes: permissoes.map((permissao) => ({
      id_permissao: permissao.idPermissao,
      codigo_permissao: permissao.codigoPermissao,
      nome_permissao: permissao.nomePermissao,
      descricao_permissao: permissao.descricaoPermissao,
      status_permissao: permissao.statusPermissao,
    })) };
  }

  @GrpcMethod('ServicoAdministracao', 'CriarPapelAdministrativo')
  async criarPapelAdministrativo(requisicao: { nome_papel?: string; descricao_papel?: string; ids_permissoes?: string[]; motivo?: string }, metadados: Metadata): Promise<{ operacao_aceita: boolean; id_papel: string; mensagem_resultado: string }> {
    const contexto = await this.obterContexto(metadados, 'administracao:gerenciar_acessos');
    const idPapel = await this.servico.criarPapel({
      nome: requisicao.nome_papel ?? '',
      descricao: requisicao.descricao_papel ?? '',
      idsPermissoes: requisicao.ids_permissoes ?? [],
      motivo: requisicao.motivo ?? '',
    }, contexto.idUsuario, contexto.correlacao);
    return { operacao_aceita: true, id_papel: idPapel, mensagem_resultado: 'Papel criado.' };
  }

  @GrpcMethod('ServicoAdministracao', 'AtualizarPapelAdministrativo')
  async atualizarPapelAdministrativo(requisicao: { id_papel?: string; nome_papel?: string; descricao_papel?: string; ids_permissoes?: string[]; motivo?: string }, metadados: Metadata) {
    const contexto = await this.obterContexto(metadados, 'administracao:gerenciar_acessos');
    await this.servico.atualizarPapel(requisicao.id_papel ?? '', {
      nome: requisicao.nome_papel ?? '',
      descricao: requisicao.descricao_papel ?? '',
      idsPermissoes: requisicao.ids_permissoes ?? [],
      motivo: requisicao.motivo ?? '',
    }, contexto.idUsuario, contexto.correlacao);
    return { operacao_aceita: true, mensagem_resultado: 'Papel atualizado.' };
  }

  @GrpcMethod('ServicoAdministracao', 'ArquivarPapelAdministrativo')
  async arquivarPapelAdministrativo(requisicao: { id_papel?: string; motivo?: string }, metadados: Metadata) {
    const contexto = await this.obterContexto(metadados, 'administracao:gerenciar_acessos');
    await this.servico.arquivarPapel(requisicao.id_papel ?? '', requisicao.motivo ?? '', contexto.idUsuario, contexto.correlacao);
    return { operacao_aceita: true, mensagem_resultado: 'Papel arquivado.' };
  }

  @GrpcMethod('ServicoAdministracao', 'RestaurarPapelAdministrativo')
  async restaurarPapelAdministrativo(requisicao: { id_papel?: string; motivo?: string }, metadados: Metadata) {
    const contexto = await this.obterContexto(metadados, 'administracao:gerenciar_acessos');
    await this.servico.restaurarPapel(requisicao.id_papel ?? '', requisicao.motivo ?? '', contexto.idUsuario, contexto.correlacao);
    return { operacao_aceita: true, mensagem_resultado: 'Papel restaurado.' };
  }

  @GrpcMethod('ServicoAdministracao', 'DefinirPermissoesPapelAdministrativo')
  async definirPermissoesPapelAdministrativo(requisicao: { id_papel?: string; ids_permissoes?: string[]; motivo?: string }, metadados: Metadata) {
    const contexto = await this.obterContexto(metadados, 'administracao:gerenciar_acessos');
    await this.servico.definirPermissoesPapel(
      requisicao.id_papel ?? '', requisicao.ids_permissoes ?? [], requisicao.motivo ?? '', contexto.idUsuario, contexto.correlacao,
    );
    return { operacao_aceita: true, mensagem_resultado: 'Matriz atualizada; sessões afetadas foram encerradas.' };
  }
}
