import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

type ClienteSaude = {
  Verificar: (
    requisicao: object,
    callback: (
      erro: grpc.ServiceError | null,
      resposta: Record<string, string>,
    ) => void,
  ) => void;
  close?: () => void;
};

type ServicosGrpc = {
  lixo_certo: {
    v1: {
      ServicoSaude: new (
        endereco: string,
        credenciais: grpc.ChannelCredentials,
      ) => ClienteSaude;
    };
  };
};

const porta = 50101;
const segredo = "segredo-e2e-nao-pode-aparecer-nos-logs";
let processo: ChildProcessWithoutNullStreams;
let logs = "";
let cliente: ClienteSaude;

function aguardarServidor(): Promise<void> {
  return new Promise((resolve, reject) => {
    const limite = setTimeout(
      () => reject(new Error("Servidor gRPC não iniciou no tempo esperado")),
      5000,
    );
    const observar = (dados: Buffer) => {
      logs += dados.toString();
      if (
        logs.includes("NestMicroservice") &&
        logs.includes("successfully started")
      ) {
        clearTimeout(limite);
        resolve();
      }
    };
    processo.stdout.on("data", observar);
    processo.stderr.on("data", observar);
    processo.once("error", (erro) => {
      clearTimeout(limite);
      reject(erro);
    });
  });
}

describe("E2E gRPC", () => {
  beforeAll(async () => {
    processo = spawn("node", [join(process.cwd(), "dist/src/principal.js")], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AMBIENTE_EXECUCAO: "desenvolvimento",
        PORTA_GRPC: String(porta),
        BANCO_DADOS_HOST: "127.0.0.1",
        BANCO_DADOS_PORTA: "5432",
        BANCO_DADOS_USUARIO: "lcr_integracao",
        BANCO_DADOS_SENHA: "lcr_integracao_local",
        BANCO_DADOS_NOME: "lcr_integracao",
        REDIS_HOST: "127.0.0.1",
        REDIS_PORT: "6379",
        REDIS_DB: "15",
        SEGREDO_HASH_PARTICIPANTE: segredo,
      },
    });
    await aguardarServidor();
    const protoPath = join(
      process.cwd(),
      "contratos/lixo_certo/v1/servico_saude.proto",
    );
    const definicao = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const servicos = grpc.loadPackageDefinition(
      definicao,
    ) as unknown as ServicosGrpc;
    cliente = new servicos.lixo_certo.v1.ServicoSaude(
      `127.0.0.1:${porta}`,
      grpc.credentials.createInsecure(),
    );
  });

  afterAll(() => {
    cliente?.close?.();
    processo?.kill("SIGTERM");
  });

  it("responde ao método Verificar e não registra o segredo nos logs", async () => {
    const resposta = await new Promise<Record<string, string>>(
      (resolve, reject) => {
        cliente.Verificar({}, (erro, resultado) =>
          erro ? reject(erro) : resolve(resultado),
        );
      },
    );
    expect(resposta.status_servico).toBe("saudavel");
    expect(resposta.status_banco).toBe("disponivel");
    expect(resposta.status_redis).toBe("disponivel");
    expect(resposta.versao_api).toBeTruthy();
    expect(logs).not.toContain(segredo);
  });
});
