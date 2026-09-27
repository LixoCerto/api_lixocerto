import { Controller } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { GrpcMethod } from '@nestjs/microservices';
import { ContextoFluxoEmail, ServicoFluxosEmail } from './fluxos_email.servico.js';

interface RequisicaoEmail {
  email_usuario?: string;
  emailUsuario?: string;
}

interface RequisicaoCodigo {
  email_usuario?: string;
  emailUsuario?: string;
  codigo_verificacao?: string;
  codigoVerificacao?: string;
}

interface RequisicaoCodigoRedefinicao {
  email_usuario?: string;
  emailUsuario?: string;
  codigo_redefinicao?: string;
  codigoRedefinicao?: string;
  nova_senha_usuario?: string;
  novaSenhaUsuario?: string;
}

@Controller()
export class ControladorGrpcFluxosEmail {
  constructor(private readonly servico: ServicoFluxosEmail) {}

  @GrpcMethod('ServicoAutenticacao', 'SolicitarVerificacaoEmail')
  async solicitarVerificacaoEmail(requisicao: RequisicaoEmail, metadados: Metadata) {
    const resposta = await this.servico.solicitarVerificacaoEmail(
      this.obterEmail(requisicao),
      this.obterContexto(metadados),
    );
    return {
      solicitacao_aceita: resposta.solicitacaoAceita,
      expira_em_segundos: resposta.expiraEmSegundos,
      mensagem_resultado: resposta.mensagemResultado,
      comprimento_codigo: resposta.comprimentoCodigo,
    };
  }

  @GrpcMethod('ServicoAutenticacao', 'ConfirmarEmail')
  async confirmarEmail(requisicao: RequisicaoCodigo, metadados: Metadata) {
    const resposta = await this.servico.confirmarEmail(
      this.obterEmail(requisicao),
      requisicao.codigo_verificacao?.trim() || requisicao.codigoVerificacao?.trim() || '',
      this.obterContexto(metadados),
    );
    return {
      email_confirmado: resposta.emailConfirmado,
      email_usuario: resposta.emailUsuario,
      mensagem_resultado: resposta.mensagemResultado,
    };
  }

  @GrpcMethod('ServicoAutenticacao', 'SolicitarRecuperacaoSenha')
  async solicitarRecuperacaoSenha(requisicao: RequisicaoEmail, metadados: Metadata) {
    const resposta = await this.servico.solicitarRecuperacaoSenha(
      this.obterEmail(requisicao),
      this.obterContexto(metadados),
    );
    return {
      solicitacao_aceita: resposta.solicitacaoAceita,
      expira_em_segundos: resposta.expiraEmSegundos,
      mensagem_resultado: resposta.mensagemResultado,
      comprimento_codigo: resposta.comprimentoCodigo,
    };
  }

  @GrpcMethod('ServicoAutenticacao', 'RedefinirSenha')
  async redefinirSenha(requisicao: RequisicaoCodigoRedefinicao, metadados: Metadata) {
    const resposta = await this.servico.redefinirSenha(
      this.obterEmail(requisicao),
      requisicao.codigo_redefinicao?.trim() || requisicao.codigoRedefinicao?.trim() || '',
      requisicao.nova_senha_usuario || requisicao.novaSenhaUsuario || '',
      this.obterContexto(metadados),
    );
    return {
      senha_redefinida: resposta.senhaRedefinida,
      sessoes_revogadas: resposta.sessoesRevogadas,
      mensagem_resultado: resposta.mensagemResultado,
    };
  }

  private obterEmail(requisicao: RequisicaoEmail): string {
    return requisicao.email_usuario?.trim() || requisicao.emailUsuario?.trim() || '';
  }

  private obterContexto(metadados: Metadata): ContextoFluxoEmail {
    return {
      enderecoIp: this.obterMetadado(metadados, 'x-forwarded-for') ?? this.obterMetadado(metadados, 'x-real-ip'),
      agenteUsuario: this.obterMetadado(metadados, 'user-agent'),
    };
  }

  private obterMetadado(metadados: Metadata, nome: string): string | undefined {
    const valor = metadados.get(nome)[0];
    return Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
  }
}