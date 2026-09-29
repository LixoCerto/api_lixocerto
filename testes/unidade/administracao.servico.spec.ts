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
