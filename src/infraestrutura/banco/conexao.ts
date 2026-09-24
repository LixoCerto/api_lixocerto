import { Sequelize } from 'sequelize';
import { inicializarModeloMaterial } from './modelos/material.modelo.js';
import { inicializarModeloAlternativa } from './modelos/alternativa.modelo.js';
import { inicializarModeloPapel } from './modelos/papel.modelo.js';
import { inicializarModeloPermissao } from './modelos/permissao.modelo.js';
import { inicializarModeloPontoColeta } from './modelos/ponto_coleta.modelo.js';
import { inicializarModeloProgressoUsuario } from './modelos/progresso_usuario.modelo.js';
import { inicializarModeloQuestao } from './modelos/questao.modelo.js';
import { inicializarModeloRespostaSus } from './modelos/resposta_sus.modelo.js';
import { inicializarModeloSessaoAvaliacao } from './modelos/sessao_avaliacao.modelo.js';
import { inicializarModeloTentativaQuestionario } from './modelos/tentativa_questionario.modelo.js';
import { inicializarModeloUsuario } from './modelos/usuario.modelo.js';

export function criarConexaoBanco(): Sequelize | null {
  const url = process.env.URL_BANCO_DADOS;
  if (!url) return null;

  const sequelize = new Sequelize(url, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: process.env.AMBIENTE_EXECUCAO === 'producao'
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

  return sequelize;
}
