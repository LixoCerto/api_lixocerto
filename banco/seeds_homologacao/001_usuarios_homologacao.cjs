'use strict';

const { randomBytes, scrypt: scryptCallback, randomUUID } = require('node:crypto');
const { QueryTypes } = require('sequelize');

const CUSTO_SCRYPT = 16384;
const BLOCO_SCRYPT = 8;
const PARALELISMO_SCRYPT = 1;
const TAMANHO_SALT = 16;
const TAMANHO_HASH = 64;
const PAPEL_ADMINISTRADOR = 'administrador';

const CONTAS = [
  {
    papel: 'usuario',
    idExterno: 'local:homologacao:usuario',
    nome: 'Homologação — Usuário',
    email: 'homologacao.usuario@exemplo.test',
    senhaFixa: 'LcrHml_Usr_7Qv2!2026',
  },
  {
    papel: 'pesquisador',
    idExterno: 'local:homologacao:pesquisador',
    nome: 'Homologação — Pesquisador',
    email: 'homologacao.pesquisador@exemplo.test',
    senhaFixa: 'LcrHml_Pesq_4Mx8!2026',
  },
  {
    papel: 'revisor',
    idExterno: 'local:homologacao:revisor',
    nome: 'Homologação — Revisor',
    email: 'homologacao.revisor@exemplo.test',
    senhaFixa: 'LcrHml_Rev_9Ka3!2026',
  },
];

function exigirOptIn() {
  if (process.env.AMBIENTE_EXECUCAO !== 'desenvolvimento') {
    throw new Error('O seeder de contas de homologação só pode rodar com AMBIENTE_EXECUCAO=desenvolvimento.');
  }
  if (process.env.LCR_SEMEAR_CONTAS_HOMOLOGACAO !== 'true') {
    throw new Error('Defina LCR_SEMEAR_CONTAS_HOMOLOGACAO=true para autorizar explicitamente este seeder local.');
  }
}

function senhasFixas() {
  const senhas = CONTAS.map(conta => ({ conta, senha: conta.senhaFixa }));
  for (const { conta, senha } of senhas) {
    if (senha.length < 12 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
      throw new Error(`A senha fixa configurada para ${conta.email} não atende aos requisitos mínimos.`);
    }
  }
  if (new Set(senhas.map(item => item.senha)).size !== senhas.length) {
    throw new Error('Cada conta de homologação deve ter uma senha fixa diferente.');
  }
  return senhas;
}

function derivarSenha(senha, salt) {
  return new Promise((resolve, reject) => {
    scryptCallback(senha, salt, TAMANHO_HASH, {
      N: CUSTO_SCRYPT,
      r: BLOCO_SCRYPT,
      p: PARALELISMO_SCRYPT,
    }, (erro, resultado) => {
      if (erro) reject(erro);
      else resolve(resultado);
    });
  });
}

async function criarHashSenha(senha) {
  const salt = randomBytes(TAMANHO_SALT);
  const derivacao = await derivarSenha(senha, salt);
  return `scrypt$${CUSTO_SCRYPT}$${BLOCO_SCRYPT}$${PARALELISMO_SCRYPT}$${salt.toString('base64url')}$${derivacao.toString('base64url')}`;
}

async function consultar(sequelize, sql, replacements, transaction) {
  return sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
    transaction,
  });
}

async function up(queryInterface) {
  exigirOptIn();
  const senhas = senhasFixas();
  const hashes = new Map();
  for (const { conta, senha } of senhas) hashes.set(conta.papel, await criarHashSenha(senha));

  await queryInterface.sequelize.transaction(async transaction => {
    const papeisAtivos = await consultar(
      queryInterface.sequelize,
      `SELECT lcr_pap_id_papel, lcr_pap_nome_papel
       FROM lcr_papeis
       WHERE lcr_pap_nome_papel IN (:nomes) AND lcr_pap_status_papel = 'ativo'`,
      { nomes: [...CONTAS.map(conta => conta.papel), PAPEL_ADMINISTRADOR] },
      transaction,
    );
    const idsPapeis = new Map(papeisAtivos.map(papel => [papel.lcr_pap_nome_papel, papel.lcr_pap_id_papel]));
    const papeisAusentes = [...CONTAS.map(conta => conta.papel), PAPEL_ADMINISTRADOR].filter(nome => !idsPapeis.has(nome));
    if (papeisAusentes.length) {
      throw new Error(`Papéis ativos ausentes; execute primeiro os seeders principais: ${papeisAusentes.join(', ')}.`);
    }

    const [administradores] = await consultar(
      queryInterface.sequelize,
      `SELECT COUNT(DISTINCT u.lcr_usr_id_usuario)::int AS quantidade
       FROM lcr_usuarios u
       INNER JOIN lcr_usuarios_papeis up ON up.lcr_upr_id_usuario = u.lcr_usr_id_usuario
       INNER JOIN lcr_papeis p ON p.lcr_pap_id_papel = up.lcr_upr_id_papel
       WHERE u.lcr_usr_status_usuario = 'ativo'
         AND p.lcr_pap_nome_papel = :papel
         AND p.lcr_pap_status_papel = 'ativo'`,
      { papel: PAPEL_ADMINISTRADOR },
      transaction,
    );
    if (Number(administradores?.quantidade ?? 0) < 1) {
      throw new Error('Nenhum administrador ativo foi encontrado; o seeder não cria nem altera contas administrativas.');
    }

    for (const { conta, senha } of senhas) {
      const conflitos = await consultar(
        queryInterface.sequelize,
        `SELECT lcr_usr_id_usuario, lcr_usr_id_externo, lcr_usr_email
         FROM lcr_usuarios
         WHERE LOWER(lcr_usr_email) = :email OR lcr_usr_id_externo = :idExterno`,
        { email: conta.email, idExterno: conta.idExterno },
        transaction,
      );
      const conflitoInesperado = conflitos.some(usuario =>
        usuario.lcr_usr_id_externo !== conta.idExterno
        || String(usuario.lcr_usr_email).toLowerCase() !== conta.email,
      );
      if (conflitoInesperado) {
        throw new Error(`A identidade ${conta.email} já pertence a uma conta não gerenciada por este seeder; nenhuma conta foi sobrescrita.`);
      }

      const hashSenha = hashes.get(conta.papel);
      let idUsuario;
      if (conflitos.length) {
        const [atualizado] = await consultar(
          queryInterface.sequelize,
          `UPDATE lcr_usuarios
           SET lcr_usr_nome = :nome,
               lcr_usr_email = :email,
               lcr_usr_hash_senha = :hashSenha,
               lcr_usr_email_verificado_em = CURRENT_TIMESTAMP,
               lcr_usr_status_usuario = 'ativo',
               lcr_usr_data_atualizacao = CURRENT_TIMESTAMP,
               lcr_usr_data_ultimo_acesso = NULL
           WHERE lcr_usr_id_externo = :idExterno
           RETURNING lcr_usr_id_usuario`,
          { nome: conta.nome, email: conta.email, hashSenha, idExterno: conta.idExterno },
          transaction,
        );
        idUsuario = atualizado?.lcr_usr_id_usuario;
      } else {
        const [criado] = await consultar(
          queryInterface.sequelize,
          `INSERT INTO lcr_usuarios (
             lcr_usr_id_usuario, lcr_usr_id_externo, lcr_usr_nome, lcr_usr_email,
             lcr_usr_hash_senha, lcr_usr_email_verificado_em, lcr_usr_status_usuario,
             lcr_usr_data_criacao, lcr_usr_data_atualizacao, lcr_usr_data_ultimo_acesso
           ) VALUES (
             :idUsuario, :idExterno, :nome, :email, :hashSenha,
             CURRENT_TIMESTAMP, 'ativo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL
           )
           RETURNING lcr_usr_id_usuario`,
          {
            idUsuario: randomUUID(),
            idExterno: conta.idExterno,
            nome: conta.nome,
            email: conta.email,
            hashSenha,
          },
          transaction,
        );
        idUsuario = criado?.lcr_usr_id_usuario;
      }
      if (!idUsuario) throw new Error(`Não foi possível criar ou atualizar a conta ${conta.email}.`);

      // Estas identidades são reservadas ao seeder; cada uma fica com exatamente um papel.
      await queryInterface.sequelize.query(
        'DELETE FROM lcr_usuarios_papeis WHERE lcr_upr_id_usuario = :idUsuario',
        { replacements: { idUsuario }, transaction },
      );
      await queryInterface.sequelize.query(
        `INSERT INTO lcr_usuarios_papeis (
           lcr_upr_id_usuario_papel, lcr_upr_id_usuario, lcr_upr_id_papel, lcr_upr_data_atribuicao
         ) VALUES (:idRelacao, :idUsuario, :idPapel, CURRENT_TIMESTAMP)`,
        {
          replacements: {
            idRelacao: randomUUID(),
            idUsuario,
            idPapel: idsPapeis.get(conta.papel),
          },
          transaction,
        },
      );
      await queryInterface.sequelize.query(
        `UPDATE lcr_sessoes SET lcr_ses_data_revogacao = CURRENT_TIMESTAMP
         WHERE lcr_ses_id_usuario = :idUsuario AND lcr_ses_data_revogacao IS NULL`,
        { replacements: { idUsuario }, transaction },
      );
    }
  });

  console.log('Contas locais de homologação prontas: usuario, pesquisador e revisor. Senhas não foram exibidas.');
}

async function down(queryInterface) {
  exigirOptIn();
  await queryInterface.sequelize.transaction(async transaction => {
    const idsExternos = CONTAS.map(conta => conta.idExterno);
    await queryInterface.sequelize.query(
      `UPDATE lcr_sessoes SET lcr_ses_data_revogacao = CURRENT_TIMESTAMP
       WHERE lcr_ses_id_usuario IN (
         SELECT lcr_usr_id_usuario FROM lcr_usuarios WHERE lcr_usr_id_externo IN (:idsExternos)
       ) AND lcr_ses_data_revogacao IS NULL`,
      { replacements: { idsExternos }, transaction },
    );
    await queryInterface.sequelize.query(
      `UPDATE lcr_usuarios SET lcr_usr_status_usuario = 'bloqueado', lcr_usr_data_atualizacao = CURRENT_TIMESTAMP
       WHERE lcr_usr_id_externo IN (:idsExternos)`,
      { replacements: { idsExternos }, transaction },
    );
  });
  console.log('Contas de homologação bloqueadas e sessões encerradas; registros preservados.');
}

module.exports = { up, down };
