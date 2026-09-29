import { BadRequestException, Injectable } from '@nestjs/common';
import { DadosMaterial, FiltroMateriais, RepositorioMateriais, StatusMaterial } from './materiais.repositorio.js';

const abrangenciasValidas = new Set(['orientacao_geral', 'logistica_reversa', 'confirmar_localmente']);
const statusValidos = new Set<StatusMaterial>(['rascunho', 'publicado', 'arquivado']);

@Injectable()
export class ServicoMateriais {
  constructor(private readonly repositorio: RepositorioMateriais) {}

  listar(filtro: FiltroMateriais, incluirTodos = false) {
    return this.repositorio.listar(filtro, incluirTodos);
  }

  obter(id: string) {
    return this.repositorio.obter(id);
  }

  criar(dados: DadosMaterial, idUsuario: string) {
    return this.repositorio.criar(validarDados(dados), idUsuario);
  }

  atualizar(id: string, dados: DadosMaterial, idUsuario: string) {
    return this.repositorio.atualizar(id, validarDados(dados), idUsuario);
  }

  alterarStatus(id: string, status: string, idUsuario: string, observacaoRevisao = '') {
    if (!statusValidos.has(status as StatusMaterial)) throw new BadRequestException('Status de material inválido');
    if (observacaoRevisao.length > 2000) throw new BadRequestException('A observação de revisão excede 2000 caracteres');
    return this.repositorio.alterarStatus(id, status as StatusMaterial, idUsuario, observacaoRevisao);
  }
}

function validarDados(dados: DadosMaterial): DadosMaterial {
  const nomeMaterial = dados.nomeMaterial?.trim();
  const categoriaMaterial = dados.categoriaMaterial?.trim();
  const classificacao = (dados.classificacao ?? '').trim();
  const notaAbrangencia = (dados.notaAbrangencia ?? '').trim();
  const instrucaoDescarte = dados.instrucaoDescarte?.trim();
  if (!nomeMaterial || nomeMaterial.length > 160) throw new BadRequestException('Nome obrigatório, com até 160 caracteres');
  if (!categoriaMaterial || categoriaMaterial.length > 80) throw new BadRequestException('Categoria obrigatória, com até 80 caracteres');
  if (classificacao.length > 500) throw new BadRequestException('A classificação deve ter até 500 caracteres');
  if (notaAbrangencia.length > 2000) throw new BadRequestException('A nota de abrangência deve ter até 2000 caracteres');
  if (!instrucaoDescarte || instrucaoDescarte.length > 12000) throw new BadRequestException('Instrução obrigatória, com até 12000 caracteres');
  const abrangencia = dados.abrangencia?.trim();
  if (!abrangenciasValidas.has(abrangencia)) throw new BadRequestException('Selecione uma abrangência válida');
  const sinonimos = normalizarLista(dados.sinonimos, 30, 160);
  const categoriasPontos = normalizarLista(dados.categoriasPontos, 20, 80);
  const rotasReferencia = normalizarLista(dados.rotasReferencia ?? [], 20, 300);
  const fontesReferencia = (dados.fontesReferencia ?? []).map(fonte => {
    const titulo = fonte.titulo?.trim();
    const url = fonte.url?.trim();
    const comprova = fonte.comprova?.trim();
    if (!titulo || titulo.length > 240 || !comprova || comprova.length > 1000) throw new BadRequestException('Cada fonte precisa de título e descrição do que comprova');
    try {
      const urlValida = new URL(url);
      if (!['http:', 'https:'].includes(urlValida.protocol)) throw new Error();
    } catch {
      throw new BadRequestException('Cada fonte deve usar um endereço HTTP ou HTTPS válido');
    }
    return { titulo, url, comprova };
  }).slice(0, 20);
  const dataVerificacao = dados.dataVerificacao?.trim() || null;
  if (dataVerificacao && !/^\d{4}-\d{2}-\d{2}$/.test(dataVerificacao)) throw new BadRequestException('Data de verificação inválida');
  return {
    codigoCatalogo: dados.codigoCatalogo?.trim().slice(0, 100) || null,
    classificacao,
    notaAbrangencia,
    nomeMaterial,
    categoriaMaterial,
    instrucaoDescarte,
    observacaoImpacto: (dados.observacaoImpacto ?? '').trim().slice(0, 5000),
    sinonimos,
    preparacao: (dados.preparacao ?? '').trim().slice(0, 5000),
    cuidados: (dados.cuidados ?? '').trim().slice(0, 5000),
    categoriasPontos,
    rotasReferencia,
    abrangencia,
    fontesReferencia,
    dataVerificacao,
  };
}

function normalizarLista(itens: string[] | undefined, limite: number, tamanhoMaximo: number): string[] {
  return [...new Set((itens ?? []).map(item => item.trim().slice(0, tamanhoMaximo)).filter(Boolean))].slice(0, limite);
}
