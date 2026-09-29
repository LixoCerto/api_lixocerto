require("dotenv").config({ path: ".env" });

const banco = {
  host: process.env.BANCO_DADOS_HOST,
  port: Number.parseInt(process.env.BANCO_DADOS_PORTA || "5432", 10),
  username: process.env.BANCO_DADOS_USUARIO,
  password: process.env.BANCO_DADOS_SENHA,
  database: process.env.BANCO_DADOS_NOME,
  dialect: "postgres",
  logging: false,
  dialectOptions:
    process.env.BANCO_DADOS_SSL === "true"
      ? { ssl: { require: true, rejectUnauthorized: true } }
      : undefined,
};

module.exports = {
  development: banco,
  test: {
    ...banco,
    host: process.env.BANCO_DADOS_TESTE_HOST || banco.host,
    port: Number.parseInt(
      process.env.BANCO_DADOS_TESTE_PORTA || String(banco.port),
      10,
    ),
    username: process.env.BANCO_DADOS_TESTE_USUARIO || banco.username,
    password: process.env.BANCO_DADOS_TESTE_SENHA || banco.password,
    database: process.env.BANCO_DADOS_TESTE_NOME || banco.database,
  },
  production: {
    ...banco,
  },
};
