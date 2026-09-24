'use strict';

const papeis = [
  ['00000000-0000-4000-8000-000000000001', 'usuario', 'Usuario comum da plataforma'],
  ['00000000-0000-4000-8000-000000000002', 'pesquisador', 'Consulta resultados agregados da pesquisa'],
  ['00000000-0000-4000-8000-000000000003', 'revisor', 'Revisa conteudo e pontos de coleta'],
  ['00000000-0000-4000-8000-000000000004', 'administrador', 'Administra a plataforma'],
];

const permissoes = [
  ['10000000-0000-4000-8000-000000000001', 'materiais:ler', 'Ler materiais'],
  ['10000000-0000-4000-8000-000000000002', 'materiais:escrever', 'Escrever materiais'],
  ['10000000-0000-4000-8000-000000000003', 'pontos_coleta:ler', 'Ler pontos de coleta'],
  ['10000000-0000-4000-8000-000000000004', 'pontos_coleta:aprovar', 'Aprovar pontos de coleta'],
  ['10000000-0000-4000-8000-000000000005', 'questionarios:responder', 'Responder questionarios'],
  ['10000000-0000-4000-8000-000000000006', 'questionarios:administrar', 'Administrar questionarios'],
  ['10000000-0000-4000-8000-000000000007', 'gamificacao:ler', 'Ler gamificacao'],
  ['10000000-0000-4000-8000-000000000008', 'avaliacao_usabilidade:enviar', 'Enviar avaliacao de usabilidade'],
  ['10000000-0000-4000-8000-000000000009', 'avaliacao_usabilidade:consultar_agregados', 'Consultar resultados agregados'],
  ['10000000-0000-4000-8000-000000000010', 'auditoria:consultar', 'Consultar auditoria'],
];

module.exports = {
  async up(queryInterface) {
    const data = new Date();
    await queryInterface.bulkInsert('lcr_papeis', papeis.map(([id, nome, descricao]) => ({
      lcr_pap_id_papel: id,
      lcr_pap_nome_papel: nome,
      lcr_pap_descricao_papel: descricao,
      lcr_pap_status_papel: 'ativo',
      lcr_pap_data_criacao: data,
      lcr_pap_data_atualizacao: data,
    })));
    await queryInterface.bulkInsert('lcr_permissoes', permissoes.map(([id, codigo, nome]) => ({
      lcr_prm_id_permissao: id,
      lcr_prm_codigo_permissao: codigo,
      lcr_prm_nome_permissao: nome,
      lcr_prm_descricao_permissao: nome,
      lcr_prm_status_permissao: 'ativo',
      lcr_prm_data_criacao: data,
      lcr_prm_data_atualizacao: data,
    })));
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('lcr_permissoes', null, {});
    await queryInterface.bulkDelete('lcr_papeis', null, {});
  },
};
