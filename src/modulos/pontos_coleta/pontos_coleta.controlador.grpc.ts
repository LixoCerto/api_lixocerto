import { Metadata } from '@grpc/grpc-js';
import { BadRequestException, Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { ServicoAutenticacao } from '../autenticacao/autenticacao.servico.js';
import { ServicoAutorizacao } from '../autorizacao/autorizacao.servico.js';
import { ServicoAuditoria } from '../auditoria/auditoria.servico.js';
import { ServicoUsuarios } from '../usuarios/usuarios.servico.js';
import { ServicoPontosColeta } from './pontos_coleta.servico.js';
import { GeocodificacaoReversa } from './geocodificacao_reversa.servico.js';
import { ServicoDescartes } from './descartes.servico.js';
import { RegistroDescarte, StatusRegistroDescarte } from './descartes.repositorio.js';

type RequisicaoDados = {
  nome_ponto_coleta?: string;
  endereco_ponto_coleta?: string;
  cidade_ponto_coleta?: string;
  estado_ponto_coleta?: string;
  cep_ponto_coleta?: string;
  latitude_ponto_coleta?: number;
  longitude_ponto_coleta?: number;
  categorias_aceitas?: string[];
  origem_informacao?: string;
  horario_funcionamento?: string;
  telefone_contato?: string;
  url_informacoes?: string;
};
type PontoResposta = {
  id_ponto_coleta: string;
  nome_ponto_coleta: string;
  endereco_ponto_coleta: string;
  cidade_ponto_coleta: string;
  estado_ponto_coleta: string;
  cep_ponto_coleta: string;
  latitude_ponto_coleta: number;
  longitude_ponto_coleta: number;
  status_verificacao: string;
  categorias_aceitas: string[];
  origem_informacao: string;
  horario_funcionamento: string;
  telefone_contato: string;
  url_informacoes: string;
  data_verificacao: string;
};

@Controller()
export class ControladorGrpcPontosColeta {
  constructor(
    private readonly servico: ServicoPontosColeta,
    private readonly autenticacao: ServicoAutenticacao,
    private readonly autorizacao: ServicoAutorizacao,
    private readonly usuarios: ServicoUsuarios,
    private readonly auditoria: ServicoAuditoria,
    private readonly geocodificacao: GeocodificacaoReversa,
    private readonly descartes: ServicoDescartes,
  ) {}

  @GrpcMethod('ServicoPontosColeta', 'ListarPontosColeta')
  async listarPontosColeta(requisicao: { cidade_ponto_coleta?: string; categoria_material?: string; latitude?: number; longitude?: number; raio_metros?: number }, metadados: Metadata): Promise<{ pontos_coleta: PontoResposta[] }> {
    const identidade = await this.obterIdentidade(metadados);
    this.autorizacao.exigirPermissao(identidade, 'pontos_coleta:ler');
    const incluirTodos = this.autorizacao.temPermissao(identidade, 'pontos_coleta:aprovar');
    const pontos = await this.servico.listar({ cidadePontoColeta: requisicao.cidade_ponto_coleta, categoriaMaterial: requisicao.categoria_material, latitude: requisicao.latitude || undefined, longitude: requisicao.longitude || undefined, raioMetros: requisicao.raio_metros }, incluirTodos);
    return { pontos_coleta: pontos.map(ponto => this.mapear(ponto)) };
  }

  @GrpcMethod('ServicoPontosColeta', 'BuscarEnderecoPorCoordenadas')
  async buscarEnderecoPorCoordenadas(requisicao: { latitude?: number; longitude?: number }, metadados: Metadata) {
    await this.obterUsuario(metadados, 'pontos_coleta:escrever');
    const latitude = requisicao.latitude;
    const longitude = requisicao.longitude;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude! < -90 || latitude! > 90 || longitude! < -180 || longitude! > 180) {
      throw new BadRequestException('Coordenadas inválidas');
    }
    const endereco = await this.geocodificacao.buscar(latitude!, longitude!);
    return endereco ? { encontrado: true, ...endereco } : {
      encontrado: false,
      cep_ponto_coleta: '',
      endereco_ponto_coleta: '',
      cidade_ponto_coleta: '',
      estado_ponto_coleta: '',
      atribuicao: '© OpenStreetMap contributors',
    };
  }

  @GrpcMethod('ServicoPontosColeta', 'ObterPontoColeta')
  async obterPontoColeta(requisicao: { id_ponto_coleta?: string }, metadados: Metadata) {
    const identidade = await this.obterIdentidade(metadados);
    this.autorizacao.exigirPermissao(identidade, 'pontos_coleta:ler');
    const ponto = await this.servico.obter(requisicao.id_ponto_coleta ?? '');
    if (!ponto || (ponto.lcr_pco_status_verificacao !== 'verificado' && !this.autorizacao.temPermissao(identidade, 'pontos_coleta:aprovar'))) return { ponto: {} };
    return { ponto: this.mapear(ponto) };
  }

  @GrpcMethod('ServicoPontosColeta', 'CriarPontoColeta')
  async criarPontoColeta(requisicao: { dados?: RequisicaoDados }, metadados: Metadata) {
    const { idUsuario } = await this.obterUsuario(metadados, 'pontos_coleta:escrever');
    const ponto = await this.servico.criar({ ...this.converterDados(requisicao.dados ?? {}), idUsuarioCadastrador: idUsuario });
    await this.registrarAuditoria('ponto_coleta_criado', ponto?.lcr_pco_id_ponto_coleta, idUsuario, metadados);
    return { ponto: ponto ? this.mapear(ponto) : {}, operacao_aceita: Boolean(ponto), mensagem_resultado: 'Ponto criado e enviado para validação.' };
  }

  @GrpcMethod('ServicoPontosColeta', 'AtualizarPontoColeta')
  async atualizarPontoColeta(requisicao: { id_ponto_coleta?: string; dados?: RequisicaoDados }, metadados: Metadata) {
    const { idUsuario } = await this.obterUsuario(metadados, 'pontos_coleta:escrever');
    const ponto = await this.servico.atualizar(requisicao.id_ponto_coleta ?? '', this.converterDados(requisicao.dados ?? {}));
    await this.registrarAuditoria('ponto_coleta_atualizado', ponto?.lcr_pco_id_ponto_coleta, idUsuario, metadados);
    return { ponto: ponto ? this.mapear(ponto) : {}, operacao_aceita: Boolean(ponto), mensagem_resultado: ponto ? 'Ponto atualizado e enviado para nova validação.' : 'Ponto não encontrado.' };
  }

  @GrpcMethod('ServicoPontosColeta', 'ExcluirPontoColeta')
  async excluirPontoColeta(requisicao: { id_ponto_coleta?: string }, metadados: Metadata) {
    const { idUsuario } = await this.obterUsuario(metadados, 'pontos_coleta:escrever');
    const aceito = await this.servico.excluir(requisicao.id_ponto_coleta ?? '');
    await this.registrarAuditoria('ponto_coleta_excluido', requisicao.id_ponto_coleta, idUsuario, metadados);
    return { operacao_aceita: aceito, mensagem_resultado: aceito ? 'Ponto excluído.' : 'Ponto não encontrado.' };
  }

  @GrpcMethod('ServicoPontosColeta', 'AlterarStatusPontoColeta')
  async alterarStatusPontoColeta(requisicao: { id_ponto_coleta?: string; status_verificacao?: string }, metadados: Metadata) {
    const { idUsuario } = await this.obterUsuario(metadados, 'pontos_coleta:aprovar');
    const ponto = await this.servico.alterarStatus(requisicao.id_ponto_coleta ?? '', (requisicao.status_verificacao ?? 'pendente') as 'pendente' | 'verificado' | 'rejeitado' | 'expirado');
    await this.registrarAuditoria(`ponto_coleta_${requisicao.status_verificacao ?? 'pendente'}`, ponto?.lcr_pco_id_ponto_coleta, idUsuario, metadados);
    return { ponto: ponto ? this.mapear(ponto) : {}, operacao_aceita: Boolean(ponto), mensagem_resultado: ponto ? 'Status atualizado.' : 'Ponto não encontrado.' };
  }

  @GrpcMethod('ServicoPontosColeta', 'RegistrarDescarte')
  async registrarDescarte(requisicao: { id_ponto_coleta?: string; categoria_material?: string; relato?: string }, metadados: Metadata) {
    const identidade = await this.obterIdentidade(metadados);
    this.autorizacao.exigirPermissao(identidade, 'pontos_coleta:ler');
    this.autorizacao.exigirPermissao(identidade, 'gamificacao:participar');
    const idUsuario = await this.usuarios.obterIdInterno(identidade.idExterno);
    if (!idUsuario) throw new Error('Usuário autenticado sem registro interno');
    const registro = await this.descartes.registrar(idUsuario, {
      idPontoColeta: requisicao.id_ponto_coleta ?? '',
      categoria: requisicao.categoria_material ?? '',
      relato: requisicao.relato ?? '',
    });
    if (registro) await this.registrarAuditoria('descarte_enviado_para_validacao', registro.idRegistro, idUsuario, metadados);
    return {
      operacao_aceita: Boolean(registro),
      mensagem_resultado: registro ? 'Registro enviado para validação. Os pontos serão creditados somente se aprovado.' : 'O ponto pode estar indisponível, não aceitar essa categoria, já ter um registro igual nas últimas 24 horas ou o limite de 10 registros em 24 horas foi atingido.',
      registro: registro ? this.mapearDescarte(registro) : {},
    };
  }

  @GrpcMethod('ServicoPontosColeta', 'ListarMeusDescartes')
  async listarMeusDescartes(_requisicao: Record<string, never>, metadados: Metadata) {
    const identidade = await this.obterIdentidade(metadados);
    this.autorizacao.exigirPermissao(identidade, 'gamificacao:ler');
    const idUsuario = await this.usuarios.obterIdInterno(identidade.idExterno);
    if (!idUsuario) throw new Error('Usuário autenticado sem registro interno');
    return { registros: (await this.descartes.listarMeus(idUsuario)).map(registro => this.mapearDescarte(registro)) };
  }

  @GrpcMethod('ServicoPontosColeta', 'ListarDescartesGestao')
  async listarDescartesGestao(requisicao: { status?: string }, metadados: Metadata) {
    await this.obterUsuario(metadados, 'pontos_coleta:aprovar');
    const status = requisicao.status === 'aprovado' || requisicao.status === 'rejeitado' || requisicao.status === 'todos' ? requisicao.status : 'pendente';
    const registros = await this.descartes.listarGestao(status as StatusRegistroDescarte | 'todos');
    return { registros: registros.map(registro => this.mapearDescarte(registro)) };
  }

  @GrpcMethod('ServicoPontosColeta', 'RevisarDescarte')
  async revisarDescarte(requisicao: { id_registro?: string; status?: string }, metadados: Metadata) {
    const { idUsuario } = await this.obterUsuario(metadados, 'pontos_coleta:aprovar');
    const registro = await this.descartes.revisar(idUsuario, requisicao.id_registro ?? '', requisicao.status ?? '');
    if (registro) await this.registrarAuditoria(`descarte_${registro.status}`, registro.idRegistro, idUsuario, metadados);
    return {
      operacao_aceita: Boolean(registro),
      mensagem_resultado: !registro ? 'Registro não encontrado, já revisado ou não elegível para aprovação.' : registro.status === 'aprovado' ? 'Descarte aprovado; 20 pontos foram creditados.' : 'Registro rejeitado; pontos não foram concedidos.',
      registro: registro ? this.mapearDescarte(registro) : {},
    };
  }

  private async obterIdentidade(metadados: Metadata) {
    const valor = metadados.get('authorization')[0];
    const autorizacao = Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
    return this.autenticacao.obterIdentidadeAtual(autorizacao);
  }
  private async obterUsuario(metadados: Metadata, permissao: string) {
    const identidade = await this.obterIdentidade(metadados);
    this.autorizacao.exigirPermissao(identidade, permissao);
    const idUsuario = await this.usuarios.obterIdInterno(identidade.idExterno);
    if (!idUsuario) throw new Error('Usuário autenticado sem registro interno');
    return { idUsuario };
  }
  private converterDados(requisicao: RequisicaoDados) {
    return { nomePontoColeta: requisicao.nome_ponto_coleta ?? '', enderecoPontoColeta: requisicao.endereco_ponto_coleta ?? '', cepPontoColeta: requisicao.cep_ponto_coleta ?? '', cidadePontoColeta: requisicao.cidade_ponto_coleta ?? '', estadoPontoColeta: requisicao.estado_ponto_coleta ?? '', latitudePontoColeta: requisicao.latitude_ponto_coleta, longitudePontoColeta: requisicao.longitude_ponto_coleta, categoriasAceitas: requisicao.categorias_aceitas ?? [], origemInformacao: requisicao.origem_informacao, horarioFuncionamento: requisicao.horario_funcionamento, telefoneContato: requisicao.telefone_contato, urlInformacoes: requisicao.url_informacoes };
  }
  private mapear(ponto: any): PontoResposta {
    return { id_ponto_coleta: ponto.lcr_pco_id_ponto_coleta, nome_ponto_coleta: ponto.lcr_pco_nome_ponto_coleta, endereco_ponto_coleta: ponto.lcr_pco_endereco_ponto_coleta, cidade_ponto_coleta: ponto.lcr_pco_cidade_ponto_coleta, estado_ponto_coleta: ponto.lcr_pco_estado_ponto_coleta, cep_ponto_coleta: ponto.lcr_pco_cep_ponto_coleta ?? '', latitude_ponto_coleta: ponto.lcr_pco_latitude_ponto_coleta === null ? 0 : Number(ponto.lcr_pco_latitude_ponto_coleta), longitude_ponto_coleta: ponto.lcr_pco_longitude_ponto_coleta === null ? 0 : Number(ponto.lcr_pco_longitude_ponto_coleta), status_verificacao: ponto.lcr_pco_status_verificacao, categorias_aceitas: ponto.lcr_pco_categorias_aceitas ?? [], origem_informacao: ponto.lcr_pco_origem_informacao ?? '', horario_funcionamento: ponto.lcr_pco_horario_funcionamento ?? '', telefone_contato: ponto.lcr_pco_telefone_contato ?? '', url_informacoes: ponto.lcr_pco_url_informacoes ?? '', data_verificacao: ponto.lcr_pco_data_verificacao ? new Date(ponto.lcr_pco_data_verificacao).toISOString() : '' };
  }
  private mapearDescarte(registro: RegistroDescarte) {
    return {
      id_registro: registro.idRegistro,
      id_ponto_coleta: registro.idPontoColeta,
      nome_ponto_coleta: registro.nomePontoColeta,
      cidade_ponto_coleta: registro.cidadePontoColeta,
      categoria_material: registro.categoriaMaterial,
      status: registro.status,
      data_registro: registro.dataRegistro,
      data_revisao: registro.dataRevisao,
      relato: registro.relato,
      identificador_participante: registro.identificadorParticipante ?? '',
      quantidade: registro.quantidade,
      pontos_concedidos: registro.pontosConcedidos,
    };
  }
  private registrarAuditoria(tipoEvento: string, idRecurso: string | undefined, idUsuario: string, metadados: Metadata) {
    return this.auditoria.registrar({ idUsuario, tipoEvento, recursoEvento: 'ponto_coleta', idRecurso, idCorrelacao: this.obterCorrelacao(metadados), detalhesEvento: { recurso: 'ponto_coleta' } });
  }
  private obterCorrelacao(metadados: Metadata) {
    const valor = metadados.get('x-id-correlacao')[0];
    return typeof valor === 'string' && valor.trim() ? valor.slice(0, 120) : randomUUID();
  }
}
