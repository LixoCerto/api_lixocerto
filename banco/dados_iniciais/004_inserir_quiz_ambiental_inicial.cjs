'use strict';

const questoes = [
  {
    id: '44000000-0000-4000-8000-000000000001',
    tema: 'pilhas_baterias',
    enunciado: 'Segundo o SINIR, o que deve fazer o consumidor que deseja descartar pilhas inservíveis?',
    explicacao: 'A orientação é levar as pilhas ao ponto de entrega mais próximo; os pontos as armazenam e, ao atingir determinada quantidade, encaminham o material para coleta e triagem. Fonte: SINIR, “Pilhas e Baterias” — https://sinir.gov.br/perfis/logistica-reversa/logistica-reversa/pilhas-e-baterias/',
    alternativas: [
      'Levá-las ao ponto de entrega mais próximo.',
      'Entregá-las diretamente a uma empresa de reciclagem.',
      'Aguardar uma coleta domiciliar obrigatória.',
      'Deixá-las em qualquer loja, mesmo sem ponto de recebimento.',
    ],
    correta: 0,
  },
  {
    id: '44000000-0000-4000-8000-000000000002',
    tema: 'eletroeletronicos',
    enunciado: 'Ao fim da vida útil de um eletroeletrônico doméstico, qual é a forma adequada de encaminhá-lo?',
    explicacao: 'A alternativa correta é entregá-lo em um ponto de recebimento: o SINIR informa que o consumidor descarta os eletroeletrônicos nesses pontos, de onde seguem para destinação ambientalmente adequada. Fonte: SINIR, “Eletroeletrônicos e seus componentes de uso doméstico” — https://sinir.gov.br/perfis/logistica-reversa/logistica-reversa/eletroeletronicos/',
    alternativas: [
      'Entregá-lo em um ponto de recebimento da logística reversa.',
      'Colocá-lo no lixo comum.',
      'Queimá-lo para reduzir seu volume.',
      'Desmontá-lo e descartar as peças no ambiente.',
    ],
    correta: 0,
  },
  {
    id: '44000000-0000-4000-8000-000000000003',
    tema: 'oleo_cozinha',
    enunciado: 'Por que o óleo de cozinha usado não deve ser despejado na pia ou no ralo?',
    explicacao: 'Na pia ou no ralo, o óleo pode se transformar em uma massa gelatinosa nos canos e na caixa de gordura, causando entupimento. Fonte: Secretaria de Estado de Meio Ambiente do Amapá, “Porque não devemos jogar óleo de cozinha na pia” — https://sema.portal.ap.gov.br/noticia/1901/porque-nao-devemos-jogar-oleo-de-cozinha-na-pia',
    alternativas: [
      'Porque pode formar massa nos canos e entupir a rede de esgoto.',
      'Porque se dissolve na água e impede sua fervura.',
      'Porque transforma toda água em água potável.',
      'Porque causa apenas manchas na louça, sem outros efeitos.',
    ],
    correta: 0,
  },
  {
    id: '44000000-0000-4000-8000-000000000004',
    tema: 'compostagem',
    enunciado: 'Segundo o Ministério do Meio Ambiente, qual é o produto final da compostagem?',
    explicacao: 'A compostagem acelera biologicamente a decomposição de materiais orgânicos e resulta em composto orgânico, que pode enriquecer o solo. Fonte: Ministério do Meio Ambiente, “O que é Compostagem” — https://www.gov.br/mma/pt-br/assuntos/educacao-ambiental/glossario-ea/o-que-e-compostagem',
    alternativas: ['Composto orgânico.', 'Biogás.', 'Água potável.', 'Plástico reciclável.'],
    correta: 0,
  },
  {
    id: '44000000-0000-4000-8000-000000000005',
    tema: 'vidro_embalagens',
    enunciado: 'Qual destes itens de vidro é listado como reciclável pelo Ministério do Meio Ambiente?',
    explicacao: 'O Ministério do Meio Ambiente lista garrafas de bebida entre os itens de vidro recicláveis; espelhos, lâmpadas e vidros de janela aparecem entre os não recicláveis nessa orientação geral. Fonte: Ministério do Meio Ambiente, “O que é Reciclagem?” — https://www.gov.br/mma/pt-br/assuntos/educacao-ambiental/glossario-ea/o-que-e-reciclagem',
    alternativas: ['Garrafa de bebida.', 'Espelho.', 'Lâmpada.', 'Vidro de janela.'],
    correta: 0,
  },
  {
    id: '44000000-0000-4000-8000-000000000006',
    tema: 'papel_papelao',
    enunciado: 'Segundo as orientações do SLU-DF, quais materiais podem ser separados para a coleta seletiva como recicláveis?',
    explicacao: 'O SLU-DF inclui papel e papelão entre os recicláveis destinados à coleta seletiva e recomenda que estejam limpos e secos sempre que possível. Essa orientação descreve o serviço do Distrito Federal; dias e formas de coleta podem variar de uma localidade para outra. Fonte: SLU-DF, “Coleta Seletiva” — https://www.slu.df.gov.br/coletaseletiva',
    alternativas: [
      'Papel e papelão, limpos e secos sempre que possível.',
      'Restos de alimentos e borra de café.',
      'Pilhas e lâmpadas usadas.',
      'Papéis engordurados ou molhados.',
    ],
    correta: 0,
  },
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      for (const questao of questoes) {
        const [porId] = await queryInterface.sequelize.query(
          'SELECT 1 FROM lcr_questoes WHERE lcr_que_id_questao = :id LIMIT 1',
          { replacements: { id: questao.id }, transaction },
        );
        const [porEnunciado] = await queryInterface.sequelize.query(
          'SELECT 1 FROM lcr_questoes WHERE lcr_que_enunciado_questao = :enunciado LIMIT 1',
          { replacements: { enunciado: questao.enunciado }, transaction },
        );
        if (porId.length > 0 || porEnunciado.length > 0) continue;

        await queryInterface.sequelize.query(
          `INSERT INTO lcr_questoes
             (lcr_que_id_questao, lcr_que_enunciado_questao, lcr_que_explicacao_questao,
              lcr_que_quantidade_pontos, lcr_que_tema_questao, lcr_que_status_questao,
              lcr_que_data_criacao, lcr_que_data_atualizacao)
           VALUES (:id, :enunciado, :explicacao, 50, :tema, 'publicada', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          { replacements: questao, transaction },
        );

        for (let indice = 0; indice < questao.alternativas.length; indice += 1) {
          const alternativaId = `45000000-0000-4000-8000-${String((Number(questao.id.slice(-12)) - 1) * 4 + indice + 1).padStart(12, '0')}`;
          await queryInterface.sequelize.query(
            `INSERT INTO lcr_alternativas
               (lcr_alt_id_alternativa, lcr_alt_id_questao, lcr_alt_texto_alternativa,
                lcr_alt_indica_correta, lcr_alt_ordem_exibicao)
             VALUES (:id, :idQuestao, :texto, :correta, :ordem)`,
            {
              replacements: {
                id: alternativaId,
                idQuestao: questao.id,
                texto: questao.alternativas[indice],
                correta: indice === questao.correta,
                ordem: indice + 1,
              },
              transaction,
            },
          );
        }
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      for (const questao of questoes) {
        await queryInterface.sequelize.query(
          `DELETE FROM lcr_questoes q
           WHERE q.lcr_que_id_questao = :id
             AND NOT EXISTS (SELECT 1 FROM lcr_tentativas_questionario t WHERE t.lcr_tqu_id_questao = q.lcr_que_id_questao)
             AND NOT EXISTS (SELECT 1 FROM lcr_quiz_atribuicoes a WHERE a.lcr_qat_id_questao = q.lcr_que_id_questao)`,
          { replacements: { id: questao.id }, transaction },
        );
      }
    });
  },
};
