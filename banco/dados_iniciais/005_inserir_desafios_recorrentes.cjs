'use strict';

const desafios = [
  {
    id: '46000000-0000-4000-8000-000000000001',
    nome: 'Ritmo diário: descarte consciente',
    descricao: 'Registre um descarte em ponto verificado que aceite o material. A equipe revisará o registro; a meta só conta após aprovação.',
    tipoAcao: 'descarte_validado',
    meta: 1,
    pontos: 20,
    periodicidade: 'diaria',
    criterios: [{ tipo: 'categorias_distintas', meta: 1 }],
  },
  {
    id: '46000000-0000-4000-8000-000000000002',
    nome: 'Semana circular: varie os materiais',
    descricao: 'Conclua descartes validados de duas categorias distintas em pontos que aceitem os materiais. A aprovação é necessária para contar.',
    tipoAcao: 'descarte_validado',
    meta: 2,
    pontos: 60,
    periodicidade: 'semanal',
    criterios: [{ tipo: 'categorias_distintas', meta: 2 }],
  },
  {
    id: '46000000-0000-4000-8000-000000000003',
    nome: 'Mês consciente: aprender e agir',
    descricao: 'Acerte um quiz ambiental e conclua descartes validados de duas categorias distintas durante o ciclo mensal.',
    tipoAcao: 'quiz_correto',
    meta: 3,
    pontos: 120,
    periodicidade: 'mensal',
    criterios: [
      { tipo: 'quiz', meta: 1 },
      { tipo: 'categorias_distintas', meta: 2 },
    ],
  },
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      for (const desafio of desafios) {
        await queryInterface.sequelize.query(
          `INSERT INTO lcr_desafios
             (lcr_des_id_desafio, lcr_des_nome_desafio, lcr_des_descricao_desafio,
              lcr_des_tipo_acao, lcr_des_meta_quantidade, lcr_des_quantidade_pontos,
              lcr_des_periodicidade, lcr_des_criterios, lcr_des_status_desafio,
              lcr_des_data_inicio, lcr_des_data_fim, lcr_des_data_criacao, lcr_des_data_atualizacao)
           SELECT :id, :nome, :descricao, :tipoAcao, :meta, :pontos,
                  :periodicidade, CAST(:criterios AS jsonb), 'publicado',
             CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
           WHERE NOT EXISTS (
             SELECT 1 FROM lcr_desafios
             WHERE lcr_des_id_desafio = :id OR lcr_des_nome_desafio = :nome
           )
           ON CONFLICT DO NOTHING`,
          {
            replacements: {
              ...desafio,
              criterios: JSON.stringify(desafio.criterios),
            },
            transaction,
          },
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      for (const desafio of desafios) {
        await queryInterface.sequelize.query(
          `DELETE FROM lcr_desafios
           WHERE lcr_des_id_desafio = :id
             AND NOT EXISTS (SELECT 1 FROM lcr_usuarios_desafios WHERE lcr_ude_id_desafio = :id)
             AND NOT EXISTS (SELECT 1 FROM lcr_acoes_sustentaveis WHERE lcr_ast_id_desafio = :id)`,
          { replacements: { id: desafio.id }, transaction },
        );
      }
    });
  },
};
