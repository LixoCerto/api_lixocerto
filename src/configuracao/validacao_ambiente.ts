export const nomesVariaveisObrigatorias = [
  "BANCO_DADOS_HOST",
  "BANCO_DADOS_PORTA",
  "BANCO_DADOS_USUARIO",
  "BANCO_DADOS_SENHA",
  "BANCO_DADOS_NOME",
  "REDIS_HOST",
  "REDIS_PORT",
  "REDIS_PASSWORD",
  "REDIS_DB",
  "SEGREDO_HASH_PARTICIPANTE",
  "SEGREDO_JWT",
] as const;

/** Variáveis exigidas quando o envio real de e-mail está habilitado em produção. */
export const nomesVariaveisEmailProducao = [
  "RESEND_CHAVE_API",
  "EMAIL_REMETENTE",
  "URL_PUBLICA_FRONTEND",
] as const;

export function validarAmbiente(ambiente: NodeJS.ProcessEnv): void {
  if (ambiente.AMBIENTE_EXECUCAO !== "producao") return;
  if (ambiente.HABILITAR_REFLECTION_GRPC === "true") {
    throw new Error(
      "HABILITAR_REFLECTION_GRPC deve permanecer desabilitada em producao",
    );
  }
  const ausentes = nomesVariaveisObrigatorias.filter(
    (nome) => !ambiente[nome]?.trim(),
  );
  if (ausentes.length > 0)
    throw new Error(`Variaveis obrigatorias ausentes: ${ausentes.join(", ")}`);

  const portaBanco = Number(ambiente.BANCO_DADOS_PORTA);
  const portaRedis = Number(ambiente.REDIS_PORT);
  const bancoInvalido =
    !Number.isInteger(portaBanco) || portaBanco < 1 || portaBanco > 65535;
  const redisInvalido =
    !Number.isInteger(portaRedis) || portaRedis < 1 || portaRedis > 65535;
  if (bancoInvalido) throw new Error("BANCO_DADOS_PORTA invalida");
  if (redisInvalido) throw new Error("REDIS_PORT invalida");
  if (!/^\d+$/.test(ambiente.REDIS_DB ?? ""))
    throw new Error("REDIS_DB invalido");
  if (ambiente.BANCO_DADOS_SSL !== "true")
    throw new Error("BANCO_DADOS_SSL deve ser true em producao");

  if ((ambiente.SEGREDO_HASH_PARTICIPANTE?.length ?? 0) < 32) {
    throw new Error(
      "SEGREDO_HASH_PARTICIPANTE deve possuir pelo menos 32 caracteres",
    );
  }
  if ((ambiente.SEGREDO_JWT?.length ?? 0) < 32) {
    throw new Error("SEGREDO_JWT deve possuir pelo menos 32 caracteres");
  }

  // Em produção o envio real por Resend é obrigatório; o provedor de log é recusado.
  if ((ambiente.PROVEDOR_EMAIL?.trim().toLowerCase() ?? "resend") === "log") {
    throw new Error("PROVEDOR_EMAIL=log nao e permitido em producao");
  }
  const emailAusentes = nomesVariaveisEmailProducao.filter(
    (nome) => !ambiente[nome]?.trim(),
  );
  if (emailAusentes.length > 0)
    throw new Error(
      `Variaveis de email obrigatorias ausentes: ${emailAusentes.join(", ")}`,
    );
  if ((ambiente.RESEND_CHAVE_API?.length ?? 0) < 10) {
    throw new Error("RESEND_CHAVE_API invalida");
  }
  const urlPublica = ambiente.URL_PUBLICA_FRONTEND?.trim();
  if (!urlPublica || !/^https:\/\//.test(urlPublica)) {
    throw new Error(
      "URL_PUBLICA_FRONTEND deve ser uma URL https valida em producao",
    );
  }
}
