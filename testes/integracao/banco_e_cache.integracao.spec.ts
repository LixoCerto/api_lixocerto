import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { criarConexaoBanco } from "../../src/infraestrutura/banco/conexao.js";
import { criarConexaoRedis } from "../../src/infraestrutura/cache/conexao_redis.js";
import { ServicoCache } from "../../src/infraestrutura/cache/cache.servico.js";
import { ServicoRateLimit } from "../../src/infraestrutura/cache/rate_limit.servico.js";
import { ModeloAcaoSustentavel } from "../../src/infraestrutura/banco/modelos/acao_sustentavel.modelo.js";
import { ModeloDesafio } from "../../src/infraestrutura/banco/modelos/desafio.modelo.js";
import { ModeloMaterial } from "../../src/infraestrutura/banco/modelos/material.modelo.js";
import { ModeloPontoColeta } from "../../src/infraestrutura/banco/modelos/ponto_coleta.modelo.js";
import { ModeloUsuario } from "../../src/infraestrutura/banco/modelos/usuario.modelo.js";
import { ModeloUsuarioDesafio } from "../../src/infraestrutura/banco/modelos/usuario_desafio.modelo.js";
import { ServicoAdministracao } from "../../src/modulos/administracao/administracao.servico.js";
import { RepositorioAuditoria } from "../../src/modulos/auditoria/auditoria.repositorio.js";
import { ServicoAuditoria } from "../../src/modulos/auditoria/auditoria.servico.js";
import { RepositorioProgresso } from "../../src/modulos/gamificacao/progresso.repositorio.js";
import { ServicoGamificacao } from "../../src/modulos/gamificacao/gamificacao.servico.js";
import { RepositorioDesafios } from "../../src/modulos/desafios/desafios.repositorio.js";
import { ServicoDesafios } from "../../src/modulos/desafios/desafios.servico.js";
import { RepositorioMateriais } from "../../src/modulos/materiais/materiais.repositorio.js";
import { RepositorioPontosColeta } from "../../src/modulos/pontos_coleta/pontos_coleta.repositorio.js";
import { ServicoUsuarios } from "../../src/modulos/usuarios/usuarios.servico.js";
import { ServicoPapeis } from "../../src/modulos/papeis/papeis.servico.js";
import { ServicoPermissoes } from "../../src/modulos/permissoes/permissoes.servico.js";
import { ServicoIdentidade } from "../../src/modulos/identidade/identidade.servico.js";
import { ServicoPerfil } from "../../src/modulos/perfil/perfil.servico.js";
import { ServicoSessoes } from "../../src/modulos/sessoes/sessoes.servico.js";

const bancoTeste = {
  host: process.env.BANCO_DADOS_TESTE_HOST ?? process.env.BANCO_DADOS_HOST,
  porta: process.env.BANCO_DADOS_TESTE_PORTA ?? process.env.BANCO_DADOS_PORTA,
  usuario:
    process.env.BANCO_DADOS_TESTE_USUARIO ?? process.env.BANCO_DADOS_USUARIO,
  senha: process.env.BANCO_DADOS_TESTE_SENHA ?? process.env.BANCO_DADOS_SENHA,
  nome: process.env.BANCO_DADOS_TESTE_NOME ?? process.env.BANCO_DADOS_NOME,
};
const redisTeste = {
  host: process.env.REDIS_TESTE_HOST ?? process.env.REDIS_HOST,
  porta: process.env.REDIS_TESTE_PORT ?? process.env.REDIS_PORT,
  senha: process.env.REDIS_TESTE_PASSWORD ?? process.env.REDIS_PASSWORD,
  banco: process.env.REDIS_TESTE_DB ?? process.env.REDIS_DB,
};
if (bancoTeste.host) {
  process.env.BANCO_DADOS_HOST = bancoTeste.host;
  process.env.BANCO_DADOS_PORTA = bancoTeste.porta;
  process.env.BANCO_DADOS_USUARIO = bancoTeste.usuario;
  process.env.BANCO_DADOS_SENHA = bancoTeste.senha;
  process.env.BANCO_DADOS_NOME = bancoTeste.nome;
}
if (redisTeste.host) {
  process.env.REDIS_HOST = redisTeste.host;
  process.env.REDIS_PORT = redisTeste.porta;
  process.env.REDIS_PASSWORD = redisTeste.senha;
  process.env.REDIS_DB = redisTeste.banco;
}
const bancoConfigurado = Boolean(bancoTeste.host && bancoTeste.nome);
const redisConfigurado = Boolean(redisTeste.host);

const banco = bancoConfigurado ? criarConexaoBanco() : null;
const redis = redisConfigurado ? criarConexaoRedis() : null;
const cache = new ServicoCache(redis);
const idsUsuarios: string[] = [];
const idsMateriais: string[] = [];
const idsPontos: string[] = [];

const bancoDescribe = describe.skipIf(!banco);
const redisDescribe = describe.skipIf(!redis);

afterAll(async () => {
  if (banco) {
    if (idsPontos.length)
      await ModeloPontoColeta.destroy({
        where: { lcr_pco_id_ponto_coleta: idsPontos },
      });
    if (idsMateriais.length)
      await ModeloMaterial.destroy({
        where: { lcr_mat_id_material: idsMateriais },
      });
    for (const idUsuario of idsUsuarios) {
      await banco.query(
        "DELETE FROM lcr_eventos_pontos WHERE lcr_evp_id_usuario = :idUsuario",
        { replacements: { idUsuario } },
      );
      await ModeloAcaoSustentavel.destroy({
        where: { lcr_ast_id_usuario: idUsuario },
      });
      await ModeloUsuarioDesafio.destroy({
        where: { lcr_ude_id_usuario: idUsuario },
      });
      await banco.query(
        "DELETE FROM lcr_usuarios_papeis WHERE lcr_upr_id_usuario = :idUsuario",
        { replacements: { idUsuario } },
      );
      await ModeloUsuario.destroy({ where: { lcr_usr_id_usuario: idUsuario } });
    }
    await banco.close();
  }
  if (redis && redis.status !== "end") await redis.quit();
});

bancoDescribe("integração PostgreSQL", () => {
  it("executa autorização, materiais e pontos verificados sobre migrations reais", async () => {
    const idExterno = `integracao-${randomUUID()}`;
    const usuarioServico = new ServicoUsuarios(banco);
    const identidade = await usuarioServico.sincronizarUsuario({
      idExterno,
      nome: "Usuário Integração",
      email: `${idExterno}@exemplo.test`,
      papeis: [],
      permissoes: [],
      emailVerificado: true,
    });
    const usuario = await ModeloUsuario.findOne({
      where: { lcr_usr_id_externo: idExterno },
    });
    expect(usuario).toBeTruthy();
    idsUsuarios.push(usuario!.lcr_usr_id_usuario);
    expect(identidade.papeis).toContain("usuario");
    expect(identidade.permissoes).toContain("materiais:ler");
    expect(identidade.permissoes).toContain("questionarios:responder");

    const publicado = await ModeloMaterial.create({
      lcr_mat_nome_material: "Garrafa de vidro — integração",
      lcr_mat_categoria_material: "vidro",
      lcr_mat_instrucao_descarte: "Encaminhar ao ponto de vidro.",
      lcr_mat_observacao_impacto: "Reduz o descarte irregular.",
      lcr_mat_status_material: "publicado",
    });
    const rascunho = await ModeloMaterial.create({
      lcr_mat_nome_material: "Material rascunho — integração",
      lcr_mat_categoria_material: "teste",
      lcr_mat_instrucao_descarte: "Ainda não publicado.",
      lcr_mat_observacao_impacto: "Não deve aparecer.",
      lcr_mat_status_material: "rascunho",
    });
    idsMateriais.push(
      publicado.lcr_mat_id_material,
      rascunho.lcr_mat_id_material,
    );
    const materiais = await new RepositorioMateriais(banco).listar({
      textoPesquisa: "integração",
    });
    expect(
      materiais.materiais.map((material) => material.lcr_mat_id_material),
    ).toContain(publicado.lcr_mat_id_material);
    expect(
      materiais.materiais.map((material) => material.lcr_mat_id_material),
    ).not.toContain(rascunho.lcr_mat_id_material);

    const verificado = await ModeloPontoColeta.create({
      lcr_pco_nome_ponto_coleta: "Ponto verificado — integração",
      lcr_pco_endereco_ponto_coleta: "Rua de teste, 100",
      lcr_pco_cidade_ponto_coleta: "João Pessoa",
      lcr_pco_estado_ponto_coleta: "PB",
      lcr_pco_latitude_ponto_coleta: -7.115,
      lcr_pco_longitude_ponto_coleta: -34.864,
      lcr_pco_status_verificacao: "verificado",
      lcr_pco_origem_informacao: "teste institucional",
      lcr_pco_id_usuario_cadastrador: usuario!.lcr_usr_id_usuario,
    });
    const pendente = await ModeloPontoColeta.create({
      lcr_pco_nome_ponto_coleta: "Ponto pendente — integração",
      lcr_pco_endereco_ponto_coleta: "Rua de teste, 200",
      lcr_pco_cidade_ponto_coleta: "João Pessoa",
      lcr_pco_estado_ponto_coleta: "PB",
      lcr_pco_status_verificacao: "pendente",
    });
    idsPontos.push(
      verificado.lcr_pco_id_ponto_coleta,
      pendente.lcr_pco_id_ponto_coleta,
    );
    const pontos = await new RepositorioPontosColeta(banco).listar({
      cidadePontoColeta: "João Pessoa",
    });
    expect(pontos.map((ponto) => ponto.lcr_pco_id_ponto_coleta)).toContain(
      verificado.lcr_pco_id_ponto_coleta,
    );
    expect(pontos.map((ponto) => ponto.lcr_pco_id_ponto_coleta)).not.toContain(
      pendente.lcr_pco_id_ponto_coleta,
    );

    const resumo = await new ServicoAdministracao(
      banco,
      new ServicoAuditoria(new RepositorioAuditoria(banco)),
    ).obterResumo();
    expect(resumo.quantidadeUsuarios).toBeGreaterThanOrEqual(1);
    expect(resumo.quantidadeMateriais).toBeGreaterThanOrEqual(1);
    expect(await new ServicoPapeis(banco).listarAtivos()).toHaveLength(4);
    expect(await new ServicoPermissoes(banco).listarAtivas()).toHaveLength(16);

    const identidadeInterna = new ServicoIdentidade(banco);
    const perfil = new ServicoPerfil(banco, identidadeInterna);
    const perfilAtual = await perfil.obter(
      idExterno,
      identidade.papeis,
      identidade.permissoes,
    );
    expect(perfilAtual.nome).toBe("Usuário Integração");
    const perfilAtualizado = await perfil.atualizarNome(
      idExterno,
      "Usuário Atualizado",
      identidade.papeis,
      identidade.permissoes,
    );
    expect(perfilAtualizado.nome).toBe("Usuário Atualizado");

    const sessoes = new ServicoSessoes(banco, identidadeInterna);
    const idSessao = await sessoes.registrar({
      idExterno,
      token: `token-${randomUUID()}`,
      tokenAtualizacao: `refresh-${randomUUID()}`,
      enderecoIp: "127.0.0.1",
      agenteUsuario: "teste-integracao",
      dataExpiracao: new Date(Date.now() + 60_000),
    });
    expect(idSessao).toBeTruthy();
    expect(await sessoes.listar(idExterno)).toHaveLength(1);
    const outroIdExterno = `outro-${randomUUID()}`;
    const outraIdentidade = await usuarioServico.sincronizarUsuario({
      idExterno: outroIdExterno,
      nome: "Outro Usuário",
      email: `${outroIdExterno}@exemplo.test`,
      papeis: [],
      permissoes: [],
      emailVerificado: true,
    });
    const outroUsuario = await ModeloUsuario.findOne({
      where: { lcr_usr_id_externo: outroIdExterno },
    });
    expect(outroUsuario).toBeTruthy();
    idsUsuarios.push(outroUsuario!.lcr_usr_id_usuario);
    expect(outraIdentidade.papeis).toContain("usuario");
    expect(await sessoes.revogar(outroIdExterno, idSessao!)).toBe(false);
    expect(await sessoes.revogar(idExterno, idSessao!)).toBe(true);
    expect(await sessoes.listar(idExterno)).toHaveLength(0);
  });

  it("processa desafio, concede pontos na conclusão e grava auditoria", async () => {
    const idExterno = `desafio-${randomUUID()}`;
    const identidade = await new ServicoUsuarios(banco).sincronizarUsuario({
      idExterno,
      nome: "Usuário Desafio",
      email: `${idExterno}@exemplo.test`,
      papeis: [],
      permissoes: [],
      emailVerificado: true,
    });
    const usuario = await ModeloUsuario.findOne({
      where: { lcr_usr_id_externo: idExterno },
    });
    expect(usuario).toBeTruthy();
    idsUsuarios.push(usuario!.lcr_usr_id_usuario);
    expect(identidade.permissoes).toContain("gamificacao:ler");

    const desafio = await ModeloDesafio.findOne({
      where: {
        lcr_des_tipo_acao: "separacao_residuos",
        lcr_des_status_desafio: "publicado",
      },
    });
    expect(desafio).toBeTruthy();
    const auditoria = new ServicoAuditoria(new RepositorioAuditoria(banco));
    const servico = new ServicoDesafios(
      new RepositorioDesafios(banco),
      new ServicoGamificacao(new RepositorioProgresso(banco)),
      auditoria,
    );
    const participacao = await servico.participar(
      usuario!.lcr_usr_id_usuario,
      desafio!.lcr_des_id_desafio,
      "correlacao-desafio",
    );
    expect(participacao?.statusParticipacao).toBe("participando");
    for (
      let indice = 0;
      indice < desafio!.lcr_des_meta_quantidade;
      indice += 1
    ) {
      const resultado = await servico.registrarAcao(
        usuario!.lcr_usr_id_usuario,
        {
          idDesafio: desafio!.lcr_des_id_desafio,
          tipoAcao: "separacao_residuos",
          descricaoAcao: `Ação de integração ${indice + 1}`,
        },
        `correlacao-acao-${indice}`,
      );
      expect(resultado).toBeTruthy();
      if (indice < desafio!.lcr_des_meta_quantidade - 1)
        expect(resultado?.desafioConcluido).toBe(false);
      if (indice === desafio!.lcr_des_meta_quantidade - 1) {
        expect(resultado?.desafioConcluido).toBe(true);
        expect(resultado?.quantidadePontos).toBe(
          desafio!.lcr_des_quantidade_pontos,
        );
      }
    }
    const progresso = await new ServicoGamificacao(
      new RepositorioProgresso(banco),
    ).obterProgresso(usuario!.lcr_usr_id_usuario);
    expect(progresso.quantidadePontos).toBe(desafio!.lcr_des_quantidade_pontos);
    const eventos = await auditoria.listar("desafio_concluido", 10);
    expect(
      eventos.registros.some(
        (evento) => evento.lcr_aud_id_usuario === usuario!.lcr_usr_id_usuario,
      ),
    ).toBe(true);
  });
});

redisDescribe("integração Redis", () => {
  it("define, lê e remove valores com TTL controlado", async () => {
    const chave = `integracao:lcr:${randomUUID()}`;
    expect(await cache.verificarConexao()).toBe(true);
    expect(await cache.definir(chave, "valor-seguro", 30)).toBe(true);
    expect(await cache.obter(chave)).toBe("valor-seguro");
    expect(await cache.remover(chave)).toBe(true);
    expect(await cache.obter(chave)).toBeNull();
    await expect(cache.definir(chave, "invalido", 0)).rejects.toThrow(
      "TTL do cache",
    );
  });

  it("bloqueia a terceira operação acima do limite da janela", async () => {
    const rateLimit = new ServicoRateLimit(redis);
    const chave = `integracao:rate:${randomUUID()}`;
    await expect(rateLimit.permitir(chave, 2, 60)).resolves.toMatchObject({
      permitido: true,
      restante: 1,
      disponivel: true,
    });
    await expect(rateLimit.permitir(chave, 2, 60)).resolves.toMatchObject({
      permitido: true,
      restante: 0,
      disponivel: true,
    });
    await expect(rateLimit.permitir(chave, 2, 60)).resolves.toMatchObject({
      permitido: false,
      restante: 0,
      disponivel: true,
    });
    await cache.remover(chave);
  });
});
