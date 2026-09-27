import { Controller } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { GrpcMethod } from '@nestjs/microservices';
import { ContextoFluxoEmail, ServicoFluxosEmail } from './fluxos_email.servico.js';

interface RequisicaoEmail {
  email_usuario?: string;
  emailUsuario?: string;
}

interface RequisicaoTokenVerificacao {
  token_verificacao?: string;
  tokenVerificacao?: string;
}

interface RequisicaoTokenRedefinicao {
  token_redefinicao?: string;
  tokenRedefinicao?: string;
  nova_senha_usuario?: string;
  novaSenhaUsuario?: string;
}

@Controller()
export class ControladorGrpcFluxosEmail {
  constructor(private readonly servico: ServicoFluxosEmail) {}

  @GrpcMethod('ServicoAutenticacao', 'SolicitarVerificacaoEmail')
  async solicitarVerificacaoEmail(requisicao: RequisicaoEmail, metadados: Metadata) {
    const resposta = await this.servico.solicitarVerificacaoEmail(
      requisicao.email_usuario?.trim() || requisicao.emailUsuario?.trim() || '',
      this.obterContexto(metadados),
    );
    return {
      solicitacao_aceita: resposta.solicitacaoAceita,
      expira_em_segundos: resposta.expiraEmSegundos,
      mensagem_resultado: resposta.mensagemResultado,
    };
  }

  @GrpcMethod('ServicoAutenticacao', 'ConfirmarEmail')
  async confirmarEmail(requisicao: RequisicaoTokenVerificacao, metadados: Metadata) {
    const resposta = await this.servico.confirmarEmail(
      requisicao.token_verificacao?.trim() || requisicao.tokenVerificacao?.trim() || '',
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
      requisicao.email_usuario?.trim() || requisicao.emailUsuario?.trim() || '',
      this.obterContexto(metadados),
    );
    return {
      solicitacao_aceita: resposta.solicitacaoAceita,
      expira_em_segundos: resposta.expiraEmSegundos,
      mensagem_resultado: resposta.mensagemResultado,
    };
  }

  @GrpcMethod('ServicoAutenticacao', 'RedefinirSenha')
  async redefinirSenha(requisicao: RequisicaoTokenRedefinicao, metadados: Metadata) {
    const resposta = await this.servico.redefinirSenha(
      requisicao.token_redefinicao?.trim() || requisicao.tokenRedefinicao?.trim() || '',
      requisicao.nova_senha_usuario || requisicao.novaSenhaUsuario || '',
      this.obterContexto(metadados),
    );
    return {
      senha_redefinida: resposta.senhaRedefinida,
      sessoes_revogadas: resposta.sessoesRevogadas,
      mensagem_resultado: resposta.mensagemResultado,
    };
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