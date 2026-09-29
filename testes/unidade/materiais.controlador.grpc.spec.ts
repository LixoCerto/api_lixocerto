import { Metadata } from '@grpc/grpc-js';
import { describe, expect, it, vi } from 'vitest';
import { ControladorGrpcMateriais } from '../../src/modulos/materiais/materiais.controlador.grpc.js';
import { RepositorioMateriais } from '../../src/modulos/materiais/materiais.repositorio.js';
import { ServicoMateriais } from '../../src/modulos/materiais/materiais.servico.js';

const identidade = {
  idExterno: 'local:admin-teste',
  nome: 'Administrador de teste',
  email: 'admin@exemplo.test',
  papeis: ['administrador'],
  permissoes: ['materiais:ler', 'materiais:escrever', 'materiais:aprovar'],
};

function metadadosAutenticados() {
  const metadados = new Metadata();
  metadados.set('authorization', 'Bearer token-teste');
  return metadados;
}

function dependencias(servico: object) {
  return [
    servico,
    { obterIdentidadeAtual: vi.fn().mockResolvedValue(identidade) },
    { exigirPermissao: vi.fn(), temPermissao: vi.fn().mockReturnValue(true) },
    { obterIdInterno: vi.fn().mockResolvedValue('00000000-0000-4000-8000-000000000001') },
    { registrar: vi.fn().mockResolvedValue(undefined) },
  ] as const;
}

describe('ControladorGrpcMateriais', () => {
  it('retorna resposta vazia quando o banco nao esta configurado para identidade autorizada', async () => {
    const servico = new ServicoMateriais(new RepositorioMateriais(null));
    const controlador = new ControladorGrpcMateriais(...dependencias(servico) as never);

    const resposta = await controlador.listarMateriais({ texto_pesquisa: 'vidro' }, metadadosAutenticados());

    expect(resposta).toEqual({ materiais: [], quantidade_total: 0 });
  });

  it('cria um rascunho preservando classificação e rotas de referência', async () => {
    const material = {
      lcr_mat_id_material: 'material-id',
      lcr_mat_classificacao: 'Embalagem de vidro',
      lcr_mat_rotas_referencia: ['PEV municipal que confirme aceitação'],
      lcr_mat_fontes_referencia: [],
      lcr_mat_status_material: 'rascunho',
    };
    const servico = { criar: vi.fn().mockResolvedValue(material) };
    const controlador = new ControladorGrpcMateriais(...dependencias(servico) as never);

    const resposta = await controlador.criarMaterial({ dados: {
      nome_material: 'Pote de vidro',
      categoria_material: 'Vidro',
      classificacao: 'Embalagem de vidro',
      instrucao_descarte: 'Confirmar o aceite local.',
      nota_abrangencia: 'O exemplo aplica-se ao operador citado na fonte; confirme a regra do município.',
      rotas_referencia: ['PEV municipal que confirme aceitação'],
      abrangencia: 'confirmar_localmente',
    } }, metadadosAutenticados());

    expect(resposta.operacao_aceita).toBe(true);
    expect(servico.criar).toHaveBeenCalledWith(expect.objectContaining({
      classificacao: 'Embalagem de vidro',
      notaAbrangencia: 'O exemplo aplica-se ao operador citado na fonte; confirme a regra do município.',
      rotasReferencia: ['PEV municipal que confirme aceitação'],
    }), '00000000-0000-4000-8000-000000000001');
  });

  it('impede publicação sem fonte de referência', async () => {
    const servico = { obter: vi.fn().mockResolvedValue({ lcr_mat_fontes_referencia: [] }) };
    const controlador = new ControladorGrpcMateriais(...dependencias(servico) as never);

    await expect(controlador.alterarStatusMaterial({ id_material: 'material-id', status_material: 'publicado' }, metadadosAutenticados()))
      .rejects.toThrow('Inclua ao menos uma fonte antes de publicar.');
  });
});
