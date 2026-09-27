import { describe, expect, it } from "vitest";
import { validarAmbiente } from "../../src/configuracao/validacao_ambiente.js";

describe("validacao de ambiente", () => {
  it("não exige infraestrutura completa em desenvolvimento", () => {
    expect(() =>
      validarAmbiente({ AMBIENTE_EXECUCAO: "desenvolvimento" }),
    ).not.toThrow();
  });

  it("exige variáveis críticas em produção", () => {
    expect(() => validarAmbiente({ AMBIENTE_EXECUCAO: "producao" })).toThrow(
      /BANCO_DADOS_HOST/,
    );
  });

  it("rejeita server reflection explicitamente habilitado em produção", () => {
    expect(() =>
      validarAmbiente({
        AMBIENTE_EXECUCAO: "producao",
        HABILITAR_REFLECTION_GRPC: "true",
      }),
    ).toThrow(/HABILITAR_REFLECTION_GRPC/);
  });

  it("rejeita segredo JWT curto mesmo com infraestrutura válida", () => {
    expect(() =>
      validarAmbiente({
        AMBIENTE_EXECUCAO: "producao",
        BANCO_DADOS_HOST: "localhost",
        BANCO_DADOS_PORTA: "5432",
        BANCO_DADOS_USUARIO: "usuario",
        BANCO_DADOS_SENHA: "senha",
        BANCO_DADOS_NOME: "banco",
        BANCO_DADOS_SSL: "true",
        REDIS_HOST: "localhost",
        REDIS_PORT: "6379",
        REDIS_PASSWORD: "senha",
        REDIS_DB: "0",
        SEGREDO_JWT: "curto",
        SEGREDO_HASH_PARTICIPANTE: "segredo-de-participante-com-32-caracteres",
      }),
    ).toThrow(/SEGREDO_JWT/);
  });
});
