require('dotenv').config({ path: '.env' });

module.exports = {
  development: {
    url: process.env.URL_BANCO_DADOS,
    dialect: 'postgres',
    logging: false,
  },
  test: {
    url: process.env.URL_BANCO_DADOS_TESTE || process.env.URL_BANCO_DADOS,
    dialect: 'postgres',
    logging: false,
  },
  production: {
    url: process.env.URL_BANCO_DADOS,
    dialect: 'postgres',
    logging: false,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: true } },
  },
};
