export const nomesVariaveisObrigatorias = [
  'URL_BANCO_DADOS',
  'URL_REDIS',
  'SEGREDO_HASH_PARTICIPANTE',
  'SEGREDO_JWT',
] as const;

/** Variáveis exigidas quando o envio real de e-mail está habilitado em produção. */
export const nomesVariaveisEmailProducao = [
  'RESEND_CHAVE_API',
  'EMAIL_REMETENTE',
  'URL_PUBLICA_FRONTEND',
] as const;

const variaveisUrl = ['URL_BANCO_DADOS', 'URL_REDIS'] as const;

export function validarAmbiente(ambiente: NodeJS.ProcessEnv): void {
  if (ambiente.AMBIENTE_EXECUCAO !== 'producao') return;
  if (ambiente.HABILITAR_REFLECTION_GRPC === 'true') {
    throw new Error('HABILITAR_REFLECTION_GRPC deve permanecer desabilitada em producao');
  }
  const ausentes = nomesVariaveisObrigatorias.filter(nome => !ambiente[nome]?.trim());
  if (ausentes.length > 0) throw new Error(`Variaveis obrigatorias ausentes: ${ausentes.join(', ')}`);

  const urlsInvalidas = variaveisUrl.filter(nome => {
    try {
      const valor = ambiente[nome];
      if (!valor) return true;
      const url = new URL(valor);
      return !url.protocol || !url.host;
    } catch {
      return true;
    }
  });
  if (urlsInvalidas.length > 0) throw new Error(`URLs invalidas: ${urlsInvalidas.join(', ')}`);
  if ((ambiente.SEGREDO_HASH_PARTICIPANTE?.length ?? 0) < 32) {
    throw new Error('SEGREDO_HASH_PARTICIPANTE deve possuir pelo menos 32 caracteres');
  }
  if ((ambiente.SEGREDO_JWT?.length ?? 0) < 32) {
    throw new Error('SEGREDO_JWT deve possuir pelo menos 32 caracteres');
  }

  // Em produção o envio real por Resend é obrigatório; o provedor de log é recusado.
  if ((ambiente.PROVEDOR_EMAIL?.trim().toLowerCase() ?? 'resend') === 'log') {
    throw new Error('PROVEDOR_EMAIL=log nao e permitido em producao');
  }
  const emailAusentes = nomesVariaveisEmailProducao.filter(nome => !ambiente[nome]?.trim());
  if (emailAusentes.length > 0) throw new Error(`Variaveis de email obrigatorias ausentes: ${emailAusentes.join(', ')}`);
  if ((ambiente.RESEND_CHAVE_API?.length ?? 0) < 10) {
    throw new Error('RESEND_CHAVE_API invalida');
  }
  const urlPublica = ambiente.URL_PUBLICA_FRONTEND?.trim();
  if (!urlPublica || !/^https:\/\//.test(urlPublica)) {
    throw new Error('URL_PUBLICA_FRONTEND deve ser uma URL https valida em producao');
  }
}
