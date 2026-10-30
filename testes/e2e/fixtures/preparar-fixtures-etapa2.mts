import "reflect-metadata";
import { QueryTypes } from "sequelize";
import { criarConexaoBanco } from "../../../src/infraestrutura/banco/conexao.js";
import { ModeloUsuario } from "../../../src/infraestrutura/banco/modelos/usuario.modelo.js";
import { ModeloPontoColeta } from "../../../src/infraestrutura/banco/modelos/ponto_coleta.modelo.js";
import { ServicoUsuarios } from "../../../src/modulos/usuarios/usuarios.servico.js";
import { criarHashSenha } from "../../../src/modulos/autenticacao/senha.util.js";

const banco = criarConexaoBanco();
if (!banco) throw new Error("Conexão de teste ausente.");

const ambiente = (process.env.AMBIENTE_EXECUCAO || "").toLowerCase();
const nomeBanco = (process.env.BANCO_DADOS_NOME || "").toLowerCase();
if (
  process.env.E2E_ALLOW_LOCAL_FIXTURES !== "1" ||
  !["desenvolvimento", "teste", "test"].includes(ambiente) ||
  !/(integracao|teste|test)/.test(nomeBanco)
) {
  throw new Error("Fixtures só podem ser aplicadas com opt-in explícito em banco local de teste.");
}

const email = process.env.E2E_USER_EMAIL;
const senha = process.env.E2E_USER_PASSWORD;
const idExterno = process.env.E2E_USER_ID_EXTERNO;
if (!email || !senha || !idExterno) throw new Error("Variáveis do usuário E2E ausentes.");
const emailLegado = process.env.E2E_LEGACY_USER_EMAIL;
const senhaLegada = process.env.E2E_LEGACY_USER_PASSWORD;
const idLegado = process.env.E2E_LEGACY_USER_ID_EXTERNO;
if (!emailLegado || !senhaLegada || !idLegado) throw new Error("Variáveis da conta legada fictícia ausentes.");

try {
  const identidade = await new ServicoUsuarios(banco).sincronizarUsuario({
    idExterno,
    nome: "Conta de Demonstração",
    email,
    papeis: [],
    permissoes: [],
    emailVerificado: true,
  });
  const usuario = await ModeloUsuario.findOne({ where: { lcr_usr_id_externo: idExterno } });
  if (!usuario) throw new Error("Não foi possível preparar a conta fictícia.");
  await usuario.update({
    lcr_usr_hash_senha: await criarHashSenha(senha),
    lcr_usr_email_verificado_em: new Date(),
    lcr_usr_status_usuario: "ativo",
  });
  const identidadeLegada = await new ServicoUsuarios(banco).sincronizarUsuario({
    idExterno: idLegado,
    nome: "Conta Legada de Teste",
    email: emailLegado,
    papeis: [],
    permissoes: [],
    emailVerificado: true,
  });
  const usuarioLegado = await ModeloUsuario.findOne({ where: { lcr_usr_id_externo: idLegado } });
  if (!usuarioLegado) throw new Error("Não foi possível preparar a conta legada fictícia.");
  await usuarioLegado.update({
    lcr_usr_hash_senha: await criarHashSenha(senhaLegada),
    lcr_usr_email_verificado_em: new Date(),
    lcr_usr_status_usuario: "ativo",
  });

  await banco.query(
    `DELETE FROM lcr_quiz_atribuicoes
     WHERE lcr_qat_id_usuario = :idUsuario AND lcr_qat_status = 'disponivel'`,
    { replacements: { idUsuario: usuario.lcr_usr_id_usuario } },
  );
  const atribuicoesQuiz = await banco.query<{ lcr_qat_id_atribuicao: string }>(
    `WITH questao AS (
       SELECT q.lcr_que_id_questao, q.lcr_que_tema_questao
       FROM lcr_questoes q
       JOIN LATERAL (
         SELECT a.lcr_alt_indica_correta
         FROM lcr_alternativas a
         WHERE a.lcr_alt_id_questao = q.lcr_que_id_questao
         ORDER BY a.lcr_alt_ordem_exibicao ASC
         LIMIT 1
       ) primeira ON primeira.lcr_alt_indica_correta = TRUE
       WHERE q.lcr_que_status_questao = 'publicada'
         AND NOT EXISTS (
           SELECT 1 FROM lcr_tentativas_questionario t
           WHERE t.lcr_tqu_id_usuario = :idUsuario
             AND t.lcr_tqu_id_questao = q.lcr_que_id_questao
         )
       ORDER BY q.lcr_que_id_questao
       LIMIT 1
     )
     INSERT INTO lcr_quiz_atribuicoes (
       lcr_qat_id_usuario, lcr_qat_id_questao, lcr_qat_tema,
       lcr_qat_pontos_sorteados, lcr_qat_status,
       lcr_qat_data_disponibilizacao, lcr_qat_data_expiracao,
       lcr_qat_indica_correta, lcr_qat_data_resposta, lcr_qat_data_criacao
     )
     SELECT :idUsuario, q.lcr_que_id_questao, COALESCE(q.lcr_que_tema_questao, 'reciclagem'),
            20, 'disponivel', CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP + INTERVAL '1 day', NULL, NULL, CURRENT_TIMESTAMP
     FROM questao q
     RETURNING lcr_qat_id_atribuicao`,
    { replacements: { idUsuario: usuario.lcr_usr_id_usuario }, type: QueryTypes.SELECT },
  );
  if (!atribuicoesQuiz.length) throw new Error("Não foi possível atribuir uma questão publicada à conta fictícia.");

  // Publicação é simulada somente nesta base descartável para exercitar o Guia.
  const materiais = await banco.query<{ lcr_mat_id_material: string }>(
    `UPDATE lcr_materiais
     SET lcr_mat_status_material = 'publicado',
         lcr_mat_data_publicacao = CURRENT_TIMESTAMP,
         lcr_mat_data_atualizacao = CURRENT_TIMESTAMP
     WHERE lcr_mat_codigo_catalogo = :codigoCatalogo
     RETURNING lcr_mat_id_material`,
    {
      replacements: {
        codigoCatalogo: "br-br-papel-papelao-rascunho-001-papel-e-papelao-secos-para-coleta-seleti-4bad42fd",
      },
      type: QueryTypes.SELECT,
    },
  );
  if (!materiais.length) throw new Error("Material revisado esperado não encontrado no seed local.");

  const nomePonto = "EMLUR — recebimento de resíduos eletrônicos";
  const [ponto] = await ModeloPontoColeta.findOrCreate({
    where: { lcr_pco_nome_ponto_coleta: nomePonto },
    defaults: {
      lcr_pco_nome_ponto_coleta: nomePonto,
      lcr_pco_endereco_ponto_coleta: "Avenida Minas Gerais, 177 — Estados",
      lcr_pco_cep_ponto_coleta: "58030090",
      lcr_pco_cidade_ponto_coleta: "João Pessoa",
      lcr_pco_estado_ponto_coleta: "PB",
      lcr_pco_latitude_ponto_coleta: -7.114392,
      lcr_pco_longitude_ponto_coleta: -34.859458,
      lcr_pco_categorias_aceitas: ["Eletroeletrônicos"],
      lcr_pco_status_verificacao: "verificado",
      lcr_pco_origem_informacao: "Fonte: notícia da Prefeitura de João Pessoa sobre recebimento de eletrônicos. Horário: Waze; confirme antes de visitar. Coordenada: pin cartográfico do Google Maps, não aferido em campo.",
      lcr_pco_data_verificacao: new Date("2026-10-30T12:00:00-03:00"),
      lcr_pco_horario_funcionamento: "Segunda a sexta, das 8h às 14h (horário listado no Waze; confirme antes da visita).",
      lcr_pco_telefone_contato: null,
      lcr_pco_url_informacoes: "https://joaopessoa.pb.gov.br/noticias/recicla-jp-da-novo-destino-a-residuos-eletronicos-e-amplia-acoes-de-inclusao-social",
      lcr_pco_id_usuario_cadastrador: usuario.lcr_usr_id_usuario,
    },
  });
  await ponto.update({
    lcr_pco_endereco_ponto_coleta: "Avenida Minas Gerais, 177 — Estados",
    lcr_pco_cep_ponto_coleta: "58030090",
    lcr_pco_cidade_ponto_coleta: "João Pessoa",
    lcr_pco_estado_ponto_coleta: "PB",
    lcr_pco_latitude_ponto_coleta: -7.114392,
    lcr_pco_longitude_ponto_coleta: -34.859458,
    lcr_pco_categorias_aceitas: ["Eletroeletrônicos"],
    lcr_pco_status_verificacao: "verificado",
    lcr_pco_origem_informacao: "Fonte: notícia da Prefeitura de João Pessoa sobre recebimento de eletrônicos. Horário: Waze; confirme antes de visitar. Coordenada: pin cartográfico do Google Maps, não aferido em campo.",
    lcr_pco_data_verificacao: new Date("2026-10-30T12:00:00-03:00"),
    lcr_pco_horario_funcionamento: "Segunda a sexta, das 8h às 14h (horário listado no Waze; confirme antes da visita).",
    lcr_pco_telefone_contato: null,
    lcr_pco_url_informacoes: "https://joaopessoa.pb.gov.br/noticias/recicla-jp-da-novo-destino-a-residuos-eletronicos-e-amplia-acoes-de-inclusao-social",
    lcr_pco_id_usuario_cadastrador: usuario.lcr_usr_id_usuario,
  });

  console.log(JSON.stringify({
    fixtures: "ready",
    usuarioFicticio: Boolean(identidade.idExterno),
    contaLegadaFicticia: Boolean(identidadeLegada.idExterno),
    materialRealDoSeedPublicadoSomenteNaBaseLocal: true,
    questaoDoSeedAtribuidaSomenteNaBaseLocal: true,
    pontoPublicadoEspelhadoEmBancoDescartavel: true,
    coordenadas: "pin cartográfico do Google Maps; não aferido em campo",
    segredoExibido: false,
  }));
} finally {
  await banco.close();
}
