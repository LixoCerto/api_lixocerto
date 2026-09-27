export interface DadosEmailVerificacao {
  nomeUsuario: string;
  urlConfirmacao: string;
  expiraEmHoras: number;
}

export interface DadosEmailRedefinicao {
  nomeUsuario: string;
  urlRedefinicao: string;
  expiraEmMinutos: number;
}

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function primeiroNome(nome: string): string {
  const parte = nome.trim().split(/\s+/)[0];
  return parte && parte.length > 0 ? parte : 'participante';
}

function molduraHtml(titulo: string, conteudo: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escaparHtml(titulo)}</title></head>
<body style="margin:0;padding:24px;background:#f6f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#17362a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dfe9e1;border-radius:24px;">
    <tr><td style="padding:28px 28px 8px;">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#3e8257;">Lixo Certo</p>
      <h1 style="margin:12px 0 0;font-size:22px;line-height:1.3;color:#17362a;">${escaparHtml(titulo)}</h1>
    </td></tr>
    <tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.65;color:#4b6a59;">${conteudo}</td></tr>
    <tr><td style="padding:0 28px 28px;">
      <p style="margin:0;padding-top:16px;border-top:1px solid #edf2ed;font-size:12px;line-height:1.6;color:#7b9485;">
        Mensagem automática do projeto Lixo Certo (TCC II). Se você não solicitou este e-mail, ignore-o: nenhuma ação será executada sem o uso do link.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

function botaoHtml(url: string, rotulo: string): string {
  return `<p style="margin:24px 0;"><a href="${escaparHtml(url)}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#17362a;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${escaparHtml(rotulo)}</a></p>`;
}

export function montarEmailVerificacao(dados: DadosEmailVerificacao): { assunto: string; html: string; texto: string } {
  const nome = primeiroNome(dados.nomeUsuario);
  const conteudo = `
    <p style="margin:16px 0;">Olá, ${escaparHtml(nome)}.</p>
    <p style="margin:0 0 8px;">Confirme seu endereço de e-mail para concluir a ativação da sua conta no Lixo Certo.</p>
    ${botaoHtml(dados.urlConfirmacao, 'Confirmar meu e-mail')}
    <p style="margin:0;font-size:13px;color:#7b9485;">O link expira em ${dados.expiraEmHoras} hora(s) e pode ser usado uma única vez.</p>
    <p style="margin:16px 0 0;font-size:12px;word-break:break-all;color:#8ea89a;">${escaparHtml(dados.urlConfirmacao)}</p>`;
  return {
    assunto: 'Confirme seu e-mail no Lixo Certo',
    html: molduraHtml('Confirme seu e-mail', conteudo),
    texto: [
      `Olá, ${nome}.`,
      '',
      'Confirme seu endereço de e-mail para concluir a ativação da sua conta no Lixo Certo.',
      '',
      dados.urlConfirmacao,
      '',
      `O link expira em ${dados.expiraEmHoras} hora(s) e pode ser usado uma única vez.`,
      '',
      'Se você não criou esta conta, ignore esta mensagem.',
    ].join('\n'),
  };
}

export function montarEmailRedefinicaoSenha(dados: DadosEmailRedefinicao): { assunto: string; html: string; texto: string } {
  const nome = primeiroNome(dados.nomeUsuario);
  const conteudo = `
    <p style="margin:16px 0;">Olá, ${escaparHtml(nome)}.</p>
    <p style="margin:0 0 8px;">Recebemos um pedido de redefinição da senha da sua conta no Lixo Certo.</p>
    ${botaoHtml(dados.urlRedefinicao, 'Redefinir minha senha')}
    <p style="margin:0;font-size:13px;color:#7b9485;">O link expira em ${dados.expiraEmMinutos} minuto(s) e pode ser usado uma única vez.</p>
    <p style="margin:16px 0 0;font-size:12px;word-break:break-all;color:#8ea89a;">${escaparHtml(dados.urlRedefinicao)}</p>
    <p style="margin:16px 0 0;font-size:13px;color:#7b9485;">Se não foi você, ignore este e-mail: sua senha atual continua válida.</p>`;
  return {
    assunto: 'Redefinição de senha do Lixo Certo',
    html: molduraHtml('Redefinir sua senha', conteudo),
    texto: [
      `Olá, ${nome}.`,
      '',
      'Recebemos um pedido de redefinição da senha da sua conta no Lixo Certo.',
      '',
      dados.urlRedefinicao,
      '',
      `O link expira em ${dados.expiraEmMinutos} minuto(s) e pode ser usado uma única vez.`,
      '',
      'Se não foi você, ignore este e-mail: sua senha atual continua válida.',
    ].join('\n'),
  };
}