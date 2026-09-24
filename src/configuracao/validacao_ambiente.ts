export const nomesVariaveisObrigatorias = [
  'URL_BANCO_DADOS',
  'URL_REDIS',
  'EMISSOR_OIDC',
  'AUDIENCIA_OIDC',
] as const;

export function validarAmbiente(ambiente: NodeJS.ProcessEnv): void {
  if (ambiente.AMBIENTE_EXECUCAO === 'producao') {
    const ausentes = nomesVariaveisObrigatorias.filter(nome => !ambiente[nome]);
    if (ausentes.length > 0) {
      throw new Error(`Variaveis obrigatorias ausentes: ${ausentes.join(', ')}`);
    }
  }
}
