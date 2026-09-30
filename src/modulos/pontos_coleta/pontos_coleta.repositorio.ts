import { Inject, Injectable } from '@nestjs/common';
import { Op, Sequelize } from 'sequelize';
import { ModeloPontoColeta, StatusPontoColeta } from '../../infraestrutura/banco/modelos/ponto_coleta.modelo.js';

export interface FiltroPontosColeta {
  cidadePontoColeta?: string;
  categoriaMaterial?: string;
  statusVerificacao?: StatusPontoColeta | 'todos';
  latitude?: number;
  longitude?: number;
  raioMetros?: number;
}
export interface DadosPontoColeta {
  nomePontoColeta: string;
  enderecoPontoColeta: string;
  cepPontoColeta?: string | null;
  cidadePontoColeta: string;
  estadoPontoColeta: string;
  latitudePontoColeta?: number | null;
  longitudePontoColeta?: number | null;
  categoriasAceitas: string[];
  origemInformacao?: string | null;
  horarioFuncionamento?: string | null;
  telefoneContato?: string | null;
  urlInformacoes?: string | null;
  idUsuarioCadastrador?: string | null;
}

@Injectable()
export class RepositorioPontosColeta {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async listar(filtro: FiltroPontosColeta, incluirTodos = false) {
    if (!this.banco) return [];
    const condicoes: Record<string, unknown> = incluirTodos || filtro.statusVerificacao === 'todos'
      ? {}
      : { lcr_pco_status_verificacao: filtro.statusVerificacao ?? 'verificado' };
    if (filtro.cidadePontoColeta?.trim()) condicoes.lcr_pco_cidade_ponto_coleta = { [Op.iLike]: filtro.cidadePontoColeta.trim() };
    if (filtro.categoriaMaterial?.trim()) condicoes.lcr_pco_categorias_aceitas = { [Op.contains]: [filtro.categoriaMaterial.trim()] };
    const pontos = await ModeloPontoColeta.findAll({ where: condicoes, order: [['lcr_pco_nome_ponto_coleta', 'ASC']], limit: 100 });
    if (filtro.latitude === undefined || filtro.longitude === undefined) return pontos;
    const raio = Math.min(100000, Math.max(100, filtro.raioMetros ?? 10000));
    return pontos.filter(ponto => {
      if (ponto.lcr_pco_latitude_ponto_coleta === null || ponto.lcr_pco_longitude_ponto_coleta === null) return false;
      const distancia = distanciaMetros(filtro.latitude!, filtro.longitude!, Number(ponto.lcr_pco_latitude_ponto_coleta), Number(ponto.lcr_pco_longitude_ponto_coleta));
      return distancia <= raio;
    });
  }

  obter(id: string) { return this.banco ? ModeloPontoColeta.findByPk(id) : Promise.resolve(null); }

  criar(dados: DadosPontoColeta) {
    if (!this.banco) return Promise.resolve(null);
    return ModeloPontoColeta.create({
      ...dadosToModel(dados),
      lcr_pco_status_verificacao: 'pendente',
    } as any);
  }

  async atualizar(id: string, dados: Partial<DadosPontoColeta>) {
    const ponto = await this.obter(id);
    if (!ponto) return null;
    await ponto.update(dadosToModel(dados));
    return ponto;
  }

  async excluir(id: string) {
    const ponto = await this.obter(id);
    if (!ponto) return false;
    await ponto.destroy();
    return true;
  }

  async alterarStatus(id: string, status: StatusPontoColeta) {
    const ponto = await this.obter(id);
    if (!ponto) return null;
    await ponto.update({ lcr_pco_status_verificacao: status, lcr_pco_data_verificacao: status === 'pendente' ? null : new Date() });
    return ponto;
  }
}

function dadosToModel(dados: Partial<DadosPontoColeta>): Record<string, unknown> {
  const resultado: Record<string, unknown> = {};
  if (dados.nomePontoColeta !== undefined) resultado.lcr_pco_nome_ponto_coleta = dados.nomePontoColeta;
  if (dados.enderecoPontoColeta !== undefined) resultado.lcr_pco_endereco_ponto_coleta = dados.enderecoPontoColeta;
  if (dados.cepPontoColeta !== undefined) resultado.lcr_pco_cep_ponto_coleta = dados.cepPontoColeta;
  if (dados.cidadePontoColeta !== undefined) resultado.lcr_pco_cidade_ponto_coleta = dados.cidadePontoColeta;
  if (dados.estadoPontoColeta !== undefined) resultado.lcr_pco_estado_ponto_coleta = dados.estadoPontoColeta;
  if (dados.latitudePontoColeta !== undefined) resultado.lcr_pco_latitude_ponto_coleta = dados.latitudePontoColeta;
  if (dados.longitudePontoColeta !== undefined) resultado.lcr_pco_longitude_ponto_coleta = dados.longitudePontoColeta;
  if (dados.categoriasAceitas !== undefined) resultado.lcr_pco_categorias_aceitas = dados.categoriasAceitas;
  if (dados.origemInformacao !== undefined) resultado.lcr_pco_origem_informacao = dados.origemInformacao;
  if (dados.horarioFuncionamento !== undefined) resultado.lcr_pco_horario_funcionamento = dados.horarioFuncionamento;
  if (dados.telefoneContato !== undefined) resultado.lcr_pco_telefone_contato = dados.telefoneContato;
  if (dados.urlInformacoes !== undefined) resultado.lcr_pco_url_informacoes = dados.urlInformacoes;
  if (dados.idUsuarioCadastrador !== undefined) resultado.lcr_pco_id_usuario_cadastrador = dados.idUsuarioCadastrador;
  return resultado;
}

function distanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const raioTerra = 6371000;
  const rad = (valor: number) => valor * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * raioTerra * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
