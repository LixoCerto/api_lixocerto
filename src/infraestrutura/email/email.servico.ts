import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { registrarEvento } from '../../comum/observabilidade/registrador.js';

export interface MensagemEmail {
  destinatario: string;
  assunto: string;
  html: string;
  texto: string;
}

export interface ResultadoEnvioEmail {
  enviado: boolean;
  provedor: 'resend' | 'log';
  idMensagem: string | null;
  motivo: string | null;
}

const PROVEDOR_PADRAO = 'resend';

/**
 * Envio de e-mail transacional do Lixo Certo.
 *
 * A chave da API do Resend permanece exclusivamente na API, conforme a orientação
 * oficial do provedor: o frontend nunca recebe nem utiliza esta credencial.
 *
 * Em desenvolvimento é possível definir `PROVEDOR_EMAIL=log` para registrar as
 * mensagens no log em vez de enviá-las. O resultado do envio é sempre declarado
 * de forma explícita por meio do campo `provedor`, e nenhum conteúdo sensível
 * (token, link completo) é gravado no log.
 */
@Injectable()
export class ServicoEmail {
  private clienteResend: Resend | null = null;

  private obterProvedor(): 'resend' | 'log' {
    const configurado = process.env.PROVEDOR_EMAIL?.trim().toLowerCase();
    if (configurado === 'log') return 'log';
    return PROVEDOR_PADRAO === 'resend' ? 'resend' : 'log';
  }

  private obterRemetente(): string {
    const email = process.env.EMAIL_REMETENTE?.trim();
    const nome = process.env.EMAIL_NOME_REMETENTE?.trim() || 'Lixo Certo';
    if (!email) return '';
    return `${nome} <${email}>`;
  }

  private obterCliente(chaveApi: string): Resend {
    if (!this.clienteResend) {
      this.clienteResend = new Resend(chaveApi);
    }
    return this.clienteResend;
  }

  /** Indica se o envio real por Resend está configurado neste processo. */
  estaConfigurado(): boolean {
    if (this.obterProvedor() === 'log') return true;
    return Boolean(process.env.RESEND_CHAVE_API?.trim() && this.obterRemetente());
  }

  async enviar(mensagem: MensagemEmail): Promise<ResultadoEnvioEmail> {
    const provedor = this.obterProvedor();
    if (provedor === 'log') return this.registrarEmLog(mensagem);

    const chaveApi = process.env.RESEND_CHAVE_API?.trim();
    const remetente = this.obterRemetente();
    if (!chaveApi || !remetente) {
      registrarEvento('email_envio_recusado', { motivo: 'provedor_resend_sem_configuracao' });
      return { enviado: false, provedor: 'resend', idMensagem: null, motivo: 'Envio de e-mail nao configurado' };
    }

    try {
      const resposta = await this.obterCliente(chaveApi).emails.send({
        from: remetente,
        to: mensagem.destinatario,
        subject: mensagem.assunto,
        html: mensagem.html,
        text: mensagem.texto,
      });
      if (resposta.error) {
        registrarEvento('email_envio_falhou', {
          provedor: 'resend',
          tipoErro: resposta.error.name,
          motivo: resposta.error.message,
        });
        return { enviado: false, provedor: 'resend', idMensagem: null, motivo: resposta.error.message };
      }
      registrarEvento('email_enviado', { provedor: 'resend', idMensagem: resposta.data?.id ?? null });
      return { enviado: true, provedor: 'resend', idMensagem: resposta.data?.id ?? null, motivo: null };
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : 'Falha desconhecida no envio de e-mail';
      registrarEvento('email_envio_falhou', { provedor: 'resend', tipoErro: erro instanceof Error ? erro.name : 'erro', motivo });
      return { enviado: false, provedor: 'resend', idMensagem: null, motivo };
    }
  }

  /**
   * Provedor de desenvolvimento: registra apenas metadados da mensagem.
   * O link com token e o corpo do e-mail nunca são gravados no log.
   */
  private registrarEmLog(mensagem: MensagemEmail): ResultadoEnvioEmail {
    const idMensagem = `log:${Date.now().toString(36)}`;
    registrarEvento('email_simulado', {
      provedor: 'log',
      idMensagem,
      destinatario: this.mascararEmail(mensagem.destinatario),
      assunto: mensagem.assunto,
    });
    return { enviado: true, provedor: 'log', idMensagem, motivo: null };
  }

  private mascararEmail(email: string): string {
    const [local, dominio] = email.split('@');
    if (!local || !dominio) return '[EMAIL_INVALIDO]';
    const visivel = local.slice(0, 1);
    return `${visivel}${'*'.repeat(Math.max(1, Math.min(6, local.length - 1)))}@${dominio}`;
  }
}
