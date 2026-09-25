export const nomesVariaveisObrigatorias = [
  'URL_BANCO_DADOS',
  'URL_REDIS',
  'EMISSOR_OIDC',
  'AUDIENCIA_OIDC',
  'ENDERECO_JWKS',
  'SEGREDO_HASH_PARTICIPANTE',
] as const;

const variaveisUrl = ['URL_BANCO_DADOS', 'URL_REDIS', 'EMISSOR_OIDC', 'ENDERECO_JWKS'] as const;

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
}
