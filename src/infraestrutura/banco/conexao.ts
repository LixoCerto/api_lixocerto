import { Sequelize } from "sequelize";
import { inicializarModeloAcaoSustentavel } from "./modelos/acao_sustentavel.modelo.js";
import { inicializarModeloDesafio } from "./modelos/desafio.modelo.js";
import { inicializarModeloMaterial } from "./modelos/material.modelo.js";
import { inicializarModeloAlternativa } from "./modelos/alternativa.modelo.js";
import { inicializarModeloPapel } from "./modelos/papel.modelo.js";
import { inicializarModeloPermissao } from "./modelos/permissao.modelo.js";
import { inicializarModeloPontoColeta } from "./modelos/ponto_coleta.modelo.js";
import { inicializarModeloProgressoUsuario } from "./modelos/progresso_usuario.modelo.js";
import { inicializarModeloQuestao } from "./modelos/questao.modelo.js";
import { inicializarModeloRespostaSus } from "./modelos/resposta_sus.modelo.js";
import { inicializarModeloRegistroAuditoria } from "./modelos/registro_auditoria.modelo.js";
import { inicializarModeloSessaoAvaliacao } from "./modelos/sessao_avaliacao.modelo.js";
import { inicializarModeloSessao } from "./modelos/sessao.modelo.js";
import { inicializarModeloTokenAutenticacao } from "./modelos/token_autenticacao.modelo.js";
import { inicializarModeloTentativaQuestionario } from "./modelos/tentativa_questionario.modelo.js";
import { inicializarModeloUsuario } from "./modelos/usuario.modelo.js";
import { inicializarModeloUsuarioDesafio } from "./modelos/usuario_desafio.modelo.js";

function inteiro(nome: string, padrao: number): number {
  const valor = Number.parseInt(process.env[nome] ?? "", 10);
  return Number.isInteger(valor) && valor > 0 ? valor : padrao;
}

export function criarConexaoBanco(): Sequelize | null {
  const host = process.env.BANCO_DADOS_HOST;
  const database = process.env.BANCO_DADOS_NOME;
  if (!host || !database) return null;

  const sequelize = new Sequelize({
    dialect: "postgres",
    host,
    port: inteiro("BANCO_DADOS_PORTA", 5432),
    username: process.env.BANCO_DADOS_USUARIO,
    password: process.env.BANCO_DADOS_SENHA,
    database,
    logging: false,
    dialectOptions:
      process.env.BANCO_DADOS_SSL === "true"
        ? { ssl: { require: true, rejectUnauthorized: true } }
        : undefined,
    pool: { max: 10, min: 0, idle: 10000, acquire: 30000 },
  });

  inicializarModeloUsuario(sequelize);
  inicializarModeloPapel(sequelize);
  inicializarModeloPermissao(sequelize);
  inicializarModeloMaterial(sequelize);
  inicializarModeloPontoColeta(sequelize);
  inicializarModeloQuestao(sequelize);
  inicializarModeloAlternativa(sequelize);
  inicializarModeloTentativaQuestionario(sequelize);
  inicializarModeloProgressoUsuario(sequelize);
  inicializarModeloSessaoAvaliacao(sequelize);
  inicializarModeloRespostaSus(sequelize);
  inicializarModeloDesafio(sequelize);
  inicializarModeloUsuarioDesafio(sequelize);
  inicializarModeloAcaoSustentavel(sequelize);
  inicializarModeloRegistroAuditoria(sequelize);
  inicializarModeloSessao(sequelize);
  inicializarModeloTokenAutenticacao(sequelize);

  return sequelize;
}
