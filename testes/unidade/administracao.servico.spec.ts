import { Sequelize } from 'sequelize';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModeloPapel } from '../../src/infraestrutura/banco/modelos/papel.modelo.js';
import { ModeloPermissao } from '../../src/infraestrutura/banco/modelos/permissao.modelo.js';
import { ServicoAdministracao } from '../../src/modulos/administracao/administracao.servico.js';
import { ServicoAuditoria } from '../../src/modulos/auditoria/auditoria.servico.js';

describe('ServicoAdministracao — proteção do papel administrador', () => {
  afterEach(() => vi.restoreAllMocks());

  it('não permite criar um papel com identificador reservado do sistema', async () => {
    const banco = { transaction: vi.fn() } as unknown as Sequelize;
    const servico = new ServicoAdministracao(banco, {} as ServicoAuditoria);

    await expect(servico.criarPapel({
      nome: 'administrador',
      descricao: 'Novo papel administrador',
      idsPermissoes: [],
      motivo: 'Teste da proteção',
    }, 'ator-1', 'correlacao-1')).rejects.toThrow('não podem ser renomeados, duplicados ou substituídos');
    expect(banco.transaction).not.toHaveBeenCalled();
  });

  it('não permite alterar a matriz do papel administrador', async () => {
    const transaction = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: vi.fn(),
      rollback: vi.fn(),
    };
    const banco = { transaction: vi.fn().mockResolvedValue(transaction) } as unknown as Sequelize;
    vi.spyOn(ModeloPapel, 'findByPk').mockResolvedValue({
      lcr_pap_nome_papel: 'administrador',
    } as ModeloPapel);
    const servico = new ServicoAdministracao(banco, {} as ServicoAuditoria);

    await expect(servico.definirPermissoesPapel('papel-admin', [], 'Proteção do sistema', 'ator-1', 'correlacao-1'))
      .rejects.toThrow('As permissões do papel administrador são protegidas pelo sistema.');
    expect(transaction.rollback).toHaveBeenCalledOnce();
    expect(transaction.commit).not.toHaveBeenCalled();
  });

  it('não permite conceder a permissão exclusiva de gestão de acessos a outro papel', async () => {
    const transaction = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: vi.fn(),
      rollback: vi.fn(),
    };
    const banco = { transaction: vi.fn().mockResolvedValue(transaction) } as unknown as Sequelize;
    vi.spyOn(ModeloPapel, 'findByPk').mockResolvedValue({ lcr_pap_nome_papel: 'moderador_local' } as ModeloPapel);
    vi.spyOn(ModeloPermissao, 'findAll')
      .mockResolvedValueOnce([{ lcr_prm_id_permissao: '10000000-0000-4000-8000-000000000015', lcr_prm_status_permissao: 'ativo' }] as ModeloPermissao[])
      .mockResolvedValueOnce([{ lcr_prm_codigo_permissao: 'administracao:gerenciar_acessos' }] as ModeloPermissao[]);
    const servico = new ServicoAdministracao(banco, {} as ServicoAuditoria);

    await expect(servico.definirPermissoesPapel(
      'papel-custom', ['10000000-0000-4000-8000-000000000015'], 'Ajuste de teste', 'ator-1', 'correlacao-1',
    )).rejects.toThrow('A permissão de gestão de acessos é exclusiva do papel administrador.');
    expect(transaction.rollback).toHaveBeenCalledOnce();
    expect(transaction.commit).not.toHaveBeenCalled();
  });
});


describe('ServicoAdministracao — listagem de usuários', () => {
  it('omite o filtro de status quando a seleção é todos, sem enviar string vazia ao ENUM', async () => {
    const usuario = {
      lcr_usr_id_usuario: 'usuario-1',
      lcr_usr_nome: 'Ana Silva',
      lcr_usr_email: 'ana@example.test',
      lcr_usr_status_usuario: 'ativo',
      lcr_usr_email_verificado_em: null,
      lcr_usr_data_criacao: new Date('2026-01-01T00:00:00.000Z'),
      lcr_usr_data_ultimo_acesso: null,
      papeis: [],
    };
    const query = vi.fn()
      .mockResolvedValueOnce([usuario])
      .mockResolvedValueOnce([{ total: 1 }]);
    const banco = { query } as unknown as Sequelize;
    const servico = new ServicoAdministracao(banco, {} as ServicoAuditoria);

    const resultado = await servico.listarUsuarios({ status: 'todos' });

    expect(resultado.total).toBe(1);
    expect(resultado.usuarios).toHaveLength(1);
    expect(query).toHaveBeenCalledTimes(2);
    for (const [sql, opcoes] of query.mock.calls) {
      expect(String(sql)).not.toContain('lcr_usr_status_usuario = :status');
      expect((opcoes as { replacements: Record<string, unknown> }).replacements).not.toHaveProperty('status');
    }
  });

  it('aplica somente um status permitido como parâmetro ao filtrar usuários', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);
    const banco = { query } as unknown as Sequelize;
    const servico = new ServicoAdministracao(banco, {} as ServicoAuditoria);

    await servico.listarUsuarios({ status: 'ativo' });

    for (const [sql, opcoes] of query.mock.calls) {
      expect(String(sql)).toContain('u.lcr_usr_status_usuario = :status');
      expect((opcoes as { replacements: Record<string, unknown> }).replacements.status).toBe('ativo');
    }
  });
});
