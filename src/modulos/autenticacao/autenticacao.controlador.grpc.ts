import { Controller } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { GrpcMethod } from '@nestjs/microservices';
import { normalizarEnderecoIp } from '../../comum/rede/endereco_ip.js';
import { ContextoSessao, RespostaAutenticacao, ServicoAutenticacao } from './autenticacao.servico.js';

interface RequisicaoCadastro {
  nome_usuario?: string;
  nomeUsuario?: string;
  email_usuario?: string;
  emailUsuario?: string;
  senha_usuario?: string;
  senhaUsuario?: string;
}

interface RequisicaoLogin {
  email_usuario?: string;
  emailUsuario?: string;
  senha_usuario?: string;
  senhaUsuario?: string;
}

interface RequisicaoLoginGoogle {
  id_token?: string;
  idToken?: string;
  nonce?: string;
}

interface RequisicaoTokenAtualizacao {
  token_atualizacao?: string;
  tokenAtualizacao?: string;
}

@Controller()
export class ControladorGrpcAutenticacao {
  constructor(private readonly servico: ServicoAutenticacao) {}

  @GrpcMethod('ServicoAutenticacao', 'CadastrarUsuario')
  async cadastrarUsuario(requisicao: RequisicaoCadastro, metadados: Metadata) {
    return this.mapearResposta(await this.servico.cadastrarUsuario(
      requisicao.nome_usuario?.trim() || requisicao.nomeUsuario?.trim() || '',
      requisicao.email_usuario?.trim() || requisicao.emailUsuario?.trim() || '',
      requisicao.senha_usuario || requisicao.senhaUsuario || '',
      this.obterContexto(metadados),
    ));
  }

  @GrpcMethod('ServicoAutenticacao', 'Entrar')
  async entrar(requisicao: RequisicaoLogin, metadados: Metadata) {
    return this.mapearResposta(await this.servico.entrar(
      requisicao.email_usuario?.trim() || requisicao.emailUsuario?.trim() || '',
      requisicao.senha_usuario || requisicao.senhaUsuario || '',
      this.obterContexto(metadados),
    ));
  }

  @GrpcMethod('ServicoAutenticacao', 'EntrarComGoogle')
  async entrarComGoogle(requisicao: RequisicaoLoginGoogle, metadados: Metadata) {
    return this.mapearResposta(await this.servico.entrarComGoogle(
      requisicao.id_token?.trim() || requisicao.idToken?.trim() || '',
      requisicao.nonce?.trim() || '',
      this.obterContexto(metadados),
    ));
  }

  @GrpcMethod('ServicoAutenticacao', 'RenovarToken')
  async renovarToken(requisicao: RequisicaoTokenAtualizacao, metadados: Metadata) {
    return this.mapearResposta(await this.servico.renovarToken(requisicao.token_atualizacao || requisicao.tokenAtualizacao || '', this.obterContexto(metadados)));
  }

  @GrpcMethod('ServicoAutenticacao', 'Sair')
  async sair(requisicao: RequisicaoTokenAtualizacao) {
    return { sessao_revogada: await this.servico.sair(requisicao.token_atualizacao || requisicao.tokenAtualizacao || '') };
  }

  @GrpcMethod('ServicoAutenticacao', 'ObterIdentidadeAtual')
  async obterIdentidadeAtual(_requisicao: unknown, metadados: Metadata) {
    const identidade = await this.servico.obterIdentidadeAtual(this.obterMetadado(metadados, 'authorization'));
    return this.mapearIdentidade(identidade);
  }

  private mapearResposta(resposta: RespostaAutenticacao) {
    return {
      token_acesso: resposta.tokenAcesso,
      token_atualizacao: resposta.tokenAtualizacao,
      expira_em_segundos: resposta.expiraEmSegundos,
      identidade: this.mapearIdentidade(resposta.identidade),
      requer_verificacao_email: resposta.requerVerificacaoEmail,
      id_sessao: resposta.idSessao,
    };
  }

  private mapearIdentidade(identidade: RespostaAutenticacao['identidade']) {
    return {
      id_usuario: identidade.idExterno,
      nome_usuario: identidade.nome,
      email_usuario: identidade.email,
      papeis_usuario: identidade.papeis,
      permissoes_usuario: identidade.permissoes,
      email_verificado_usuario: identidade.emailVerificado,
    };
  }

  private obterContexto(metadados: Metadata): ContextoSessao {
    return {
      enderecoIp: normalizarEnderecoIp(
        this.obterMetadado(metadados, 'cf-connecting-ip'),
        this.obterMetadado(metadados, 'x-forwarded-for'),
        this.obterMetadado(metadados, 'x-real-ip'),
      ),
      agenteUsuario: this.obterMetadado(metadados, 'user-agent'),
    };
  }

  private obterMetadado(metadados: Metadata, nome: string): string | undefined {
    const valor = metadados.get(nome)[0];
    return Buffer.isBuffer(valor) ? valor.toString('utf8') : typeof valor === 'string' ? valor : undefined;
  }
}
