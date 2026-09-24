'use strict';

const { QueryTypes } = require('sequelize');

const desafios = [
  {
    lcr_des_id_desafio: '30000000-0000-4000-8000-000000000001',
    lcr_des_nome_desafio: 'Semana sem descartável',
    lcr_des_descricao_desafio: 'Substitua itens descartáveis por alternativas reutilizáveis durante sete ações registradas.',
    lcr_des_tipo_acao: 'reducao_descartaveis',
    lcr_des_meta_quantidade: 7,
    lcr_des_quantidade_pontos: 150,
  },
  {
    lcr_des_id_desafio: '30000000-0000-4000-8000-000000000002',
    lcr_des_nome_desafio: 'Separação consciente',
    lcr_des_descricao_desafio: 'Registre cinco ações de separação correta de resíduos e consulte as orientações de descarte.',
    lcr_des_tipo_acao: 'separacao_residuos',
    lcr_des_meta_quantidade: 5,
    lcr_des_quantidade_pontos: 100,
  },
];

module.exports = {
  async up(queryInterface) {
    const existentes = await queryInterface.sequelize.query(
      'SELECT lcr_des_id_desafio FROM lcr_desafios',
      { type: QueryTypes.SELECT },
    );
    const idsExistentes = new Set(existentes.map(item => item.lcr_des_id_desafio));
    const data = new Date();
    const novos = desafios
      .filter(desafio => !idsExistentes.has(desafio.lcr_des_id_desafio))
      .map(desafio => ({
        ...desafio,
        lcr_des_status_desafio: 'publicado',
        lcr_des_data_inicio: data,
        lcr_des_data_fim: null,
        lcr_des_data_criacao: data,
        lcr_des_data_atualizacao: data,
      }));
    if (novos.length) await queryInterface.bulkInsert('lcr_desafios', novos);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('lcr_desafios', {
      lcr_des_id_desafio: desafios.map(desafio => desafio.lcr_des_id_desafio),
    });
  },
};
