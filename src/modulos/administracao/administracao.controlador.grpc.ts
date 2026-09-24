import { Controller } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { GrpcMethod } from '@nestjs/microservices';
import { ServicoAutenticacao } from '../autenticacao/autenticacao.servico.js';
import { ServicoAutorizacao } from '../autorizacao/autorizacao.servico.js';
import { ServicoAdministracao } from './administracao.servico.js';

@Controller()
export class ControladorGrpcAdministracao {
  constructor(
    private readonly servico: ServicoAdministracao,
    private readonly autenticacao: ServicoAutenticacao,
    private readonly autorizacao: ServicoAutorizacao,
  ) {}

  @GrpcMethod('ServicoAdministracao', 'ObterResumoAdministrativo')
  async obterResumoAdministrativo(_requisicao: unknown, metadados: Metadata): Promise<{
    quantidade_usuarios: number;
    quantidade_materiais: number;
    quantidade_pontos_pendentes: number;
    quantidade_avaliacoes: number;
  }> {
    const valor = metadados.get('authorization')[0];
    const autorizacao = Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
    const usuario = await this.autenticacao.obterIdentidadeAtual(autorizacao);
    this.autorizacao.exigirPermissao(usuario, 'administracao:consultar');
    const resumo = await this.servico.obterResumo();
    return {
      quantidade_usuarios: resumo.quantidadeUsuarios,
      quantidade_materiais: resumo.quantidadeMateriais,
      quantidade_pontos_pendentes: resumo.quantidadePontosPendentes,
      quantidade_avaliacoes: resumo.quantidadeAvaliacoes,
    };
  }
}
