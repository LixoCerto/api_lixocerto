'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lcr_questoes', 'lcr_que_tema_questao', {
      type: Sequelize.STRING(80), allowNull: false, defaultValue: 'residuos',
    });
    await queryInterface.addColumn('lcr_progresso_usuarios', 'lcr_prg_proximo_quiz_em', {
      type: Sequelize.DATE, allowNull: true,
    });
    await queryInterface.addColumn('lcr_progresso_usuarios', 'lcr_prg_ultimo_tema_quiz', {
      type: Sequelize.STRING(80), allowNull: true,
    });

    await queryInterface.createTable('lcr_quiz_atribuicoes', {
      lcr_qat_id_atribuicao: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_qat_id_usuario: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_qat_id_questao: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_questoes', key: 'lcr_que_id_questao' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_qat_tema: { type: Sequelize.STRING(80), allowNull: false },
      lcr_qat_pontos_sorteados: { type: Sequelize.INTEGER, allowNull: false },
      lcr_qat_status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'disponivel' },
      lcr_qat_data_disponibilizacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      lcr_qat_data_expiracao: { type: Sequelize.DATE, allowNull: false },
      lcr_qat_indica_correta: { type: Sequelize.BOOLEAN, allowNull: true },
      lcr_qat_data_resposta: { type: Sequelize.DATE, allowNull: true },
      lcr_qat_data_criacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('lcr_quiz_atribuicoes', {
      fields: ['lcr_qat_id_usuario', 'lcr_qat_id_questao'], type: 'unique', name: 'uq_lcr_qat_usuario_questao',
    });
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX uq_lcr_qat_uma_ativa_usuario
      ON lcr_quiz_atribuicoes (lcr_qat_id_usuario)
      WHERE lcr_qat_status = 'disponivel'
    `);
    await queryInterface.addIndex('lcr_quiz_atribuicoes', ['lcr_qat_id_usuario', 'lcr_qat_status'], { name: 'ix_lcr_qat_usuario_status' });

    await queryInterface.createTable('lcr_eventos_pontos', {
      lcr_evp_id_evento: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_evp_id_usuario: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_evp_tipo_origem: { type: Sequelize.STRING(40), allowNull: false },
      lcr_evp_codigo_origem: { type: Sequelize.STRING(200), allowNull: false },
      lcr_evp_categoria: { type: Sequelize.STRING(80), allowNull: true },
      lcr_evp_quantidade_pontos: { type: Sequelize.INTEGER, allowNull: false },
      lcr_evp_data_registro: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('lcr_eventos_pontos', {
      fields: ['lcr_evp_id_usuario', 'lcr_evp_tipo_origem', 'lcr_evp_codigo_origem'], type: 'unique', name: 'uq_lcr_evp_origem_usuario',
    });
    await queryInterface.addIndex('lcr_eventos_pontos', ['lcr_evp_id_usuario', 'lcr_evp_tipo_origem', 'lcr_evp_data_registro'], { name: 'ix_lcr_evp_usuario_tipo_data' });
    await queryInterface.addIndex('lcr_eventos_pontos', ['lcr_evp_id_usuario', 'lcr_evp_categoria'], { name: 'ix_lcr_evp_usuario_categoria' });

    await queryInterface.createTable('lcr_selos', {
      lcr_sel_id_selo: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_sel_codigo: { type: Sequelize.STRING(60), allowNull: false, unique: true },
      lcr_sel_nome: { type: Sequelize.STRING(100), allowNull: false },
      lcr_sel_descricao: { type: Sequelize.STRING(300), allowNull: false },
      lcr_sel_pontos_minimos: { type: Sequelize.INTEGER, allowNull: false },
      lcr_sel_icone: { type: Sequelize.STRING(60), allowNull: false, defaultValue: 'leaf' },
      lcr_sel_ativo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      lcr_sel_data_criacao: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.createTable('lcr_usuarios_selos', {
      lcr_usu_id_usuario_selo: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_usu_id_usuario: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      lcr_usu_id_selo: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_selos', key: 'lcr_sel_id_selo' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_usu_data_conquista: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('lcr_usuarios_selos', {
      fields: ['lcr_usu_id_usuario', 'lcr_usu_id_selo'], type: 'unique', name: 'uq_lcr_usu_usuario_selo',
    });
    await queryInterface.sequelize.query(`
      INSERT INTO lcr_selos (lcr_sel_codigo, lcr_sel_nome, lcr_sel_descricao, lcr_sel_pontos_minimos, lcr_sel_icone) VALUES
        ('broto_consciente', 'Broto consciente', 'Primeiros passos rumo a escolhas mais sustentáveis.', 100, 'sprout'),
        ('separador_atento', 'Separador atento', 'Já acumulou pontos aprendendo e separando resíduos corretamente.', 250, 'recycle'),
        ('guardiao_circular', 'Guardião circular', 'Mostra consistência em ações de economia circular.', 500, 'shield-check'),
        ('agente_transformador', 'Agente transformador', 'Contribui de forma consistente para uma cidade mais limpa.', 1500, 'award'),
        ('embaixador_lixocerto', 'Embaixador LixoCerto', 'Alcançou um marco de excelência em educação e ação ambiental.', 4000, 'medal')
      ON CONFLICT (lcr_sel_codigo) DO NOTHING
    `);

    await queryInterface.createTable('lcr_registros_descartes', {
      lcr_rde_id_registro_descarte: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      lcr_rde_id_usuario: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_rde_id_ponto_coleta: { type: Sequelize.UUID, allowNull: false, references: { model: 'lcr_pontos_coleta', key: 'lcr_pco_id_ponto_coleta' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      lcr_rde_categoria_material: { type: Sequelize.STRING(80), allowNull: false },
      lcr_rde_quantidade: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      lcr_rde_relato: { type: Sequelize.STRING(500), allowNull: true },
      lcr_rde_status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'pendente' },
      lcr_rde_id_revisor: { type: Sequelize.UUID, allowNull: true, references: { model: 'lcr_usuarios', key: 'lcr_usr_id_usuario' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      lcr_rde_data_revisao: { type: Sequelize.DATE, allowNull: true },
      lcr_rde_data_registro: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('lcr_registros_descartes', ['lcr_rde_status', 'lcr_rde_data_registro'], { name: 'ix_lcr_rde_status_data' });
    await queryInterface.addIndex('lcr_registros_descartes', ['lcr_rde_id_usuario', 'lcr_rde_data_registro'], { name: 'ix_lcr_rde_usuario_data' });

    await queryInterface.addColumn('lcr_desafios', 'lcr_des_periodicidade', {
      type: Sequelize.STRING(20), allowNull: false, defaultValue: 'unica',
    });
    await queryInterface.addColumn('lcr_desafios', 'lcr_des_criterios', {
      type: Sequelize.JSONB, allowNull: false, defaultValue: [],
    });
    await queryInterface.addColumn('lcr_usuarios_desafios', 'lcr_ude_periodo_chave', {
      type: Sequelize.STRING(20), allowNull: false, defaultValue: 'unica',
    });
    await queryInterface.addColumn('lcr_usuarios_desafios', 'lcr_ude_progresso_criterios', {
      type: Sequelize.JSONB, allowNull: false, defaultValue: [],
    });
    await queryInterface.removeConstraint('lcr_usuarios_desafios', 'uq_lcr_ude_usuario_desafio');
    await queryInterface.addConstraint('lcr_usuarios_desafios', {
      fields: ['lcr_ude_id_usuario', 'lcr_ude_id_desafio', 'lcr_ude_periodo_chave'], type: 'unique', name: 'uq_lcr_ude_usuario_desafio_periodo',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('lcr_usuarios_desafios', 'uq_lcr_ude_usuario_desafio_periodo');
    await queryInterface.addConstraint('lcr_usuarios_desafios', {
      fields: ['lcr_ude_id_usuario', 'lcr_ude_id_desafio'], type: 'unique', name: 'uq_lcr_ude_usuario_desafio',
    });
    await queryInterface.removeColumn('lcr_usuarios_desafios', 'lcr_ude_periodo_chave');
    await queryInterface.removeColumn('lcr_usuarios_desafios', 'lcr_ude_progresso_criterios');
    await queryInterface.removeColumn('lcr_desafios', 'lcr_des_periodicidade');
    await queryInterface.removeColumn('lcr_desafios', 'lcr_des_criterios');
    await queryInterface.dropTable('lcr_registros_descartes');
    await queryInterface.dropTable('lcr_usuarios_selos');
    await queryInterface.dropTable('lcr_selos');
    await queryInterface.dropTable('lcr_eventos_pontos');
    await queryInterface.dropTable('lcr_quiz_atribuicoes');
    await queryInterface.removeColumn('lcr_progresso_usuarios', 'lcr_prg_proximo_quiz_em');
    await queryInterface.removeColumn('lcr_progresso_usuarios', 'lcr_prg_ultimo_tema_quiz');
    await queryInterface.removeColumn('lcr_questoes', 'lcr_que_tema_questao');
  },
};
