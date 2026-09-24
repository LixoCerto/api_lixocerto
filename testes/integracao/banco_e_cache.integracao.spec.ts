import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { Redis } from 'ioredis';
import { criarConexaoBanco } from '../../src/infraestrutura/banco/conexao.js';
import { criarConexaoRedis } from '../../src/infraestrutura/cache/conexao_redis.js';
import { ServicoCache } from '../../src/infraestrutura/cache/cache.servico.js';
import { ModeloMaterial } from '../../src/infraestrutura/banco/modelos/material.modelo.js';
import { ModeloPontoColeta } from '../../src/infraestrutura/banco/modelos/ponto_coleta.modelo.js';
import { ModeloUsuario } from '../../src/infraestrutura/banco/modelos/usuario.modelo.js';
import { RepositorioMateriais } from '../../src/modulos/materiais/materiais.repositorio.js';
import { RepositorioPontosColeta } from '../../src/modulos/pontos_coleta/pontos_coleta.repositorio.js';
import { ServicoUsuarios } from '../../src/modulos/usuarios/usuarios.servico.js';

const urlBanco = process.env.URL_BANCO_DADOS_TESTE ?? process.env.URL_BANCO_DADOS;
const urlRedis = process.env.URL_REDIS_TESTE ?? process.env.URL_REDIS;
if (urlBanco) process.env.URL_BANCO_DADOS = urlBanco;
if (urlRedis) process.env.URL_REDIS = urlRedis;

const banco = urlBanco ? criarConexaoBanco() : null;
const redis = urlRedis ? criarConexaoRedis() : null;
const cache = new ServicoCache(redis);
const idsUsuarios: string[] = [];
const idsMateriais: string[] = [];
const idsPontos: string[] = [];

const bancoDescribe = describe.skipIf(!banco);
const redisDescribe = describe.skipIf(!redis);

afterAll(async () => {
  if (banco) {
    if (idsPontos.length) await ModeloPontoColeta.destroy({ where: { lcr_pco_id_ponto_coleta: idsPontos } });
    if (idsMateriais.length) await ModeloMaterial.destroy({ where: { lcr_mat_id_material: idsMateriais } });
    for (const idUsuario of idsUsuarios) {
      await banco.query('DELETE FROM lcr_usuarios_papeis WHERE lcr_upr_id_usuario = :idUsuario', { replacements: { idUsuario } });
      await ModeloUsuario.destroy({ where: { lcr_usr_id_usuario: idUsuario } });
    }
    await banco.close();
  }
  if (redis && redis.status !== 'end') await redis.quit();
});

bancoDescribe('integração PostgreSQL', () => {
  it('executa autorização, materiais e pontos verificados sobre migrations reais', async () => {
    const idExterno = `integracao-${randomUUID()}`;
    const usuarioServico = new ServicoUsuarios(banco);
    const identidade = await usuarioServico.sincronizarUsuario({
      idExterno,
      nome: 'Usuário Integração',
      email: `${idExterno}@exemplo.test`,
      papeis: [],
      permissoes: [],
    });
    const usuario = await ModeloUsuario.findOne({ where: { lcr_usr_id_externo: idExterno } });
    expect(usuario).toBeTruthy();
    idsUsuarios.push(usuario!.lcr_usr_id_usuario);
    expect(identidade.papeis).toContain('usuario');
    expect(identidade.permissoes).toContain('materiais:ler');
    expect(identidade.permissoes).toContain('questionarios:responder');

    const publicado = await ModeloMaterial.create({
      lcr_mat_nome_material: 'Garrafa de vidro — integração',
      lcr_mat_categoria_material: 'vidro',
      lcr_mat_instrucao_descarte: 'Encaminhar ao ponto de vidro.',
      lcr_mat_observacao_impacto: 'Reduz o descarte irregular.',
      lcr_mat_status_material: 'publicado',
    });
    const rascunho = await ModeloMaterial.create({
      lcr_mat_nome_material: 'Material rascunho — integração',
      lcr_mat_categoria_material: 'teste',
      lcr_mat_instrucao_descarte: 'Ainda não publicado.',
      lcr_mat_observacao_impacto: 'Não deve aparecer.',
      lcr_mat_status_material: 'rascunho',
    });
    idsMateriais.push(publicado.lcr_mat_id_material, rascunho.lcr_mat_id_material);
    const materiais = await new RepositorioMateriais(banco).listar({ textoPesquisa: 'integração' });
    expect(materiais.materiais.map(material => material.lcr_mat_id_material)).toContain(publicado.lcr_mat_id_material);
    expect(materiais.materiais.map(material => material.lcr_mat_id_material)).not.toContain(rascunho.lcr_mat_id_material);

    const verificado = await ModeloPontoColeta.create({
      lcr_pco_nome_ponto_coleta: 'Ponto verificado — integração',
      lcr_pco_endereco_ponto_coleta: 'Rua de teste, 100',
      lcr_pco_cidade_ponto_coleta: 'João Pessoa',
      lcr_pco_estado_ponto_coleta: 'PB',
      lcr_pco_latitude_ponto_coleta: -7.115,
      lcr_pco_longitude_ponto_coleta: -34.864,
      lcr_pco_status_verificacao: 'verificado',
      lcr_pco_origem_informacao: 'teste institucional',
      lcr_pco_id_usuario_cadastrador: usuario!.lcr_usr_id_usuario,
    });
    const pendente = await ModeloPontoColeta.create({
      lcr_pco_nome_ponto_coleta: 'Ponto pendente — integração',
      lcr_pco_endereco_ponto_coleta: 'Rua de teste, 200',
      lcr_pco_cidade_ponto_coleta: 'João Pessoa',
      lcr_pco_estado_ponto_coleta: 'PB',
      lcr_pco_status_verificacao: 'pendente',
    });
    idsPontos.push(verificado.lcr_pco_id_ponto_coleta, pendente.lcr_pco_id_ponto_coleta);
    const pontos = await new RepositorioPontosColeta(banco).listar({ cidadePontoColeta: 'João Pessoa' });
    expect(pontos.map(ponto => ponto.lcr_pco_id_ponto_coleta)).toContain(verificado.lcr_pco_id_ponto_coleta);
    expect(pontos.map(ponto => ponto.lcr_pco_id_ponto_coleta)).not.toContain(pendente.lcr_pco_id_ponto_coleta);
  });
});

redisDescribe('integração Redis', () => {
  it('define, lê e remove valores com TTL controlado', async () => {
    const chave = `integracao:lcr:${randomUUID()}`;
    expect(await cache.verificarConexao()).toBe(true);
    expect(await cache.definir(chave, 'valor-seguro', 30)).toBe(true);
    expect(await cache.obter(chave)).toBe('valor-seguro');
    expect(await cache.remover(chave)).toBe(true);
    expect(await cache.obter(chave)).toBeNull();
    await expect(cache.definir(chave, 'invalido', 0)).rejects.toThrow('TTL do cache');
  });
});
