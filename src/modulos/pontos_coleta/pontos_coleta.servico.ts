import { BadRequestException, Injectable } from '@nestjs/common';
import { DadosPontoColeta, FiltroPontosColeta, RepositorioPontosColeta } from './pontos_coleta.repositorio.js';

@Injectable()
export class ServicoPontosColeta {
  constructor(private readonly repositorio: RepositorioPontosColeta) {}

  listar(filtro: FiltroPontosColeta, incluirTodos = false) {
    return this.repositorio.listar(filtro, incluirTodos);
  }

  obter(id: string) { return this.repositorio.obter(id); }

  criar(dados: DadosPontoColeta) {
    return this.repositorio.criar(validarDados(dados, false) as DadosPontoColeta);
  }

  atualizar(id: string, dados: Partial<DadosPontoColeta>) {
    return this.repositorio.atualizar(id, validarDados(dados, true));
  }

  excluir(id: string) { return this.repositorio.excluir(id); }

  alterarStatus(id: string, status: 'pendente' | 'verificado' | 'rejeitado' | 'expirado') {
    if (!['pendente', 'verificado', 'rejeitado', 'expirado'].includes(status)) throw new BadRequestException('Status de ponto de coleta inválido');
    return this.repositorio.alterarStatus(id, status);
  }
}

function validarDados(dados: Partial<DadosPontoColeta>, parcial: boolean): Partial<DadosPontoColeta> {
  const resultado = { ...dados };
  for (const campo of ['nomePontoColeta', 'enderecoPontoColeta', 'cidadePontoColeta', 'estadoPontoColeta'] as const) {
    if (resultado[campo] !== undefined) resultado[campo] = resultado[campo]!.trim();
    if (!parcial && !resultado[campo]) throw new BadRequestException(`Campo obrigatório: ${campo}`);
    if (resultado[campo] !== undefined && !resultado[campo]) throw new BadRequestException(`Campo inválido: ${campo}`);
  }
  if (resultado.cepPontoColeta !== undefined) {
    const cep = resultado.cepPontoColeta?.replace(/\D/g, '') ?? '';
    if (cep && cep.length !== 8) throw new BadRequestException('CEP deve conter oito dígitos');
    resultado.cepPontoColeta = cep || null;
  }
  if (resultado.estadoPontoColeta && !/^[A-Za-z]{2}$/.test(resultado.estadoPontoColeta)) throw new BadRequestException('Estado deve conter duas letras');
  const lat = resultado.latitudePontoColeta;
  const lon = resultado.longitudePontoColeta;
  if ((lat === null) !== (lon === null) || (lat === undefined) !== (lon === undefined)) throw new BadRequestException('Latitude e longitude devem ser informadas juntas');
  if (lat !== undefined && lat !== null && (lat < -90 || lat > 90)) throw new BadRequestException('Latitude inválida');
  if (lon !== undefined && lon !== null && (lon < -180 || lon > 180)) throw new BadRequestException('Longitude inválida');
  resultado.estadoPontoColeta = resultado.estadoPontoColeta?.toUpperCase();
  resultado.categoriasAceitas = [...new Set((resultado.categoriasAceitas ?? []).map(item => item.trim()).filter(Boolean))].slice(0, 30);
  return resultado;
}
