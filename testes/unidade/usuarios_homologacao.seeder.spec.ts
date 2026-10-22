import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verificarSenha } from '../../src/modulos/autenticacao/senha.util.js';

const require = createRequire(import.meta.url);
const seeder = require('../../banco/seeds_homologacao/001_usuarios_homologacao.cjs') as {
  up: (queryInterface: unknown) => Promise<void>;
  down: (queryInterface: unknown) => Promise<void>;
};

const variaveis = [
  'AMBIENTE_EXECUCAO',
  'LCR_SEMEAR_CONTAS_HOMOLOGACAO',
  'LCR_HOMOLOGACAO_SENHA_USUARIO',
  'LCR_HOMOLOGACAO_SENHA_PESQUISADOR',
  'LCR_HOMOLOGACAO_SENHA_REVISOR',
] as const;
const originais = new Map(variaveis.map(nome => [nome, process.env[nome]]));
const senhas = [
  'TesteLocalUsuario_2026',
  'TesteLocalPesquisador_2026',
  'TesteLocalRevisor_2026',
] as const;

function configurarAmbiente() {
  process.env.AMBIENTE_EXECUCAO = 'desenvolvimento';
  process.env.LCR_SEMEAR_CONTAS_HOMOLOGACAO = 'true';
  process.env.LCR_HOMOLOGACAO_SENHA_USUARIO = senhas[0];
  process.env.LCR_HOMOLOGACAO_SENHA_PESQUISADOR = senhas[1];
  process.env.LCR_HOMOLOGACAO_SENHA_REVISOR = senhas[2];
}

afterEach(() => {
  for (const [nome, valor] of originais) {
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  }
  vi.restoreAllMocks();
});

function criarQueryInterface(opcoes: { contasExistentes?: boolean; conflito?: boolean } = {}) {
  const chamadas: { sql: string; opcoes?: Record<string, unknown> }[] = [];
  const papeis = [
    { lcr_pap_id_papel: 'papel-usuario', lcr_pap_nome_papel: 'usuario' },
    { lcr_pap_id_papel: 'papel-pesquisador', lcr_pap_nome_papel: 'pesquisador' },
    { lcr_pap_id_papel: 'papel-revisor', lcr_pap_nome_papel: 'revisor' },
    { lcr_pap_id_papel: 'papel-administrador', lcr_pap_nome_papel: 'administrador' },
  ];
  const query = vi.fn(async (sql: string, consulta: Record<string, unknown> = {}) => {
    chamadas.push({ sql: String(sql), opcoes: consulta });
    if (String(sql).includes('COUNT(DISTINCT u.lcr_usr_id_usuario)')) return [{ quantidade: 2 }];
    if (String(sql).includes('SELECT lcr_pap_id_papel, lcr_pap_nome_papel')) return papeis;
    if (String(sql).includes('FROM lcr_usuarios') && String(sql).includes('lcr_usr_id_externo = :idExterno')) {
      const replacements = consulta.replacements as Record<string, string>;
      if (opcoes.conflito && replacements.email === 'homologacao.usuario@exemplo.test') {
        return [{ lcr_usr_id_usuario: 'conta-alheia', lcr_usr_id_externo: 'local:outra-conta', lcr_usr_email: replacements.email }];
      }
      if (opcoes.contasExistentes) {
        return [{
          lcr_usr_id_usuario: `id-${replacements.idExterno}`,
          lcr_usr_id_externo: replacements.idExterno,
          lcr_usr_email: replacements.email,
        }];
      }
      return [];
    }
    if (String(sql).includes('INSERT INTO lcr_usuarios (') || String(sql).includes('UPDATE lcr_usuarios')) {
      const replacements = consulta.replacements as Record<string, string>;
      return [{ lcr_usr_id_usuario: replacements.idUsuario ?? `id-${replacements.idExterno}` }];
    }
    return [];
  });
  const sequelize = {
    query,
    transaction: vi.fn(async (callback: (transaction: object) => Promise<void>) => callback({ id: 'transacao-teste' })),
  };
  return { queryInterface: { sequelize }, chamadas, query, sequelize };
}

describe('seeder de contas de homologação', () => {
  it('recusa execução sem opt-in e fora do ambiente de desenvolvimento, antes de consultar o banco', async () => {
    configurarAmbiente();
    const producao = criarQueryInterface();
    process.env.AMBIENTE_EXECUCAO = 'producao';
    await expect(seeder.up(producao.queryInterface)).rejects.toThrow('só pode rodar com AMBIENTE_EXECUCAO=desenvolvimento');
    expect(producao.query).not.toHaveBeenCalled();

    const semOptIn = criarQueryInterface();
    process.env.AMBIENTE_EXECUCAO = 'desenvolvimento';
    process.env.LCR_SEMEAR_CONTAS_HOMOLOGACAO = 'false';
    await expect(seeder.up(semOptIn.queryInterface)).rejects.toThrow('autorizar explicitamente');
    expect(semOptIn.query).not.toHaveBeenCalled();
  });

  it('cria três contas isoladas com hash scrypt compatível e um papel por conta', async () => {
    configurarAmbiente();
    const mock = criarQueryInterface();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await seeder.up(mock.queryInterface);

    const insercoesUsuarios = mock.chamadas.filter(chamada => chamada.sql.includes('INSERT INTO lcr_usuarios ('));
    expect(insercoesUsuarios).toHaveLength(3);
    expect(insercoesUsuarios.map(chamada => (chamada.opcoes?.replacements as Record<string, string>).email)).toEqual([
      'homologacao.usuario@exemplo.test',
      'homologacao.pesquisador@exemplo.test',
      'homologacao.revisor@exemplo.test',
    ]);
    for (let indice = 0; indice < insercoesUsuarios.length; indice += 1) {
      const insercao = insercoesUsuarios[indice];
      const senha = senhas[indice];
      if (!insercao || !senha) throw new Error('Conta de teste ausente no resultado do seeder.');
      const hash = (insercao.opcoes?.replacements as Record<string, string> | undefined)?.hashSenha;
      if (!hash) throw new Error('Hash scrypt ausente na inserção de conta de teste.');
      expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
      expect(await verificarSenha(senha, hash)).toBe(true);
    }
    const atribuicoes = mock.chamadas.filter(chamada => chamada.sql.includes('INSERT INTO lcr_usuarios_papeis'));
    expect(atribuicoes.map(chamada => (chamada.opcoes?.replacements as Record<string, string>).idPapel)).toEqual([
      'papel-usuario',
      'papel-pesquisador',
      'papel-revisor',
    ]);
    expect(mock.chamadas.some(chamada => chamada.sql.includes('UPDATE lcr_sessoes'))).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('usuario, pesquisador e revisor'));
    expect(log.mock.calls.flat().join(' ')).not.toContain(senhas[0]);
  });

  it('reutiliza apenas as identidades reservadas do seeder ao ser executado novamente', async () => {
    configurarAmbiente();
    const mock = criarQueryInterface({ contasExistentes: true });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await seeder.up(mock.queryInterface);

    expect(mock.chamadas.filter(chamada => chamada.sql.includes('UPDATE lcr_usuarios')).length).toBe(3);
    expect(mock.chamadas.some(chamada => chamada.sql.includes('INSERT INTO lcr_usuarios ('))).toBe(false);
    expect(mock.chamadas.filter(chamada => chamada.sql.includes('DELETE FROM lcr_usuarios_papeis'))).toHaveLength(3);
  });

  it('recusa sobrescrever uma conta existente que colida com um e-mail de teste', async () => {
    configurarAmbiente();
    const mock = criarQueryInterface({ conflito: true });

    await expect(seeder.up(mock.queryInterface)).rejects.toThrow('nenhuma conta foi sobrescrita');
    expect(mock.chamadas.some(chamada => chamada.sql.includes('INSERT INTO lcr_usuarios ('))).toBe(false);
  });

  it('bloqueia e encerra sessões no rollback sem apagar contas ou histórico', async () => {
    configurarAmbiente();
    const mock = criarQueryInterface();

    await seeder.down(mock.queryInterface);

    expect(mock.chamadas.some(chamada => chamada.sql.includes('UPDATE lcr_sessoes'))).toBe(true);
    expect(mock.chamadas.some(chamada => chamada.sql.includes("SET lcr_usr_status_usuario = 'bloqueado'"))).toBe(true);
    expect(mock.chamadas.some(chamada => chamada.sql.includes('DELETE FROM lcr_usuarios'))).toBe(false);
  });
});
