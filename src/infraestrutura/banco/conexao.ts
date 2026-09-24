import { Sequelize } from 'sequelize';

export function criarConexaoBanco(): Sequelize | null {
  const url = process.env.URL_BANCO_DADOS;
  if (!url) return null;

  return new Sequelize(url, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: process.env.AMBIENTE_EXECUCAO === 'producao'
      ? { ssl: { require: true, rejectUnauthorized: true } }
      : undefined,
    pool: { max: 10, min: 0, idle: 10000, acquire: 30000 },
  });
}
