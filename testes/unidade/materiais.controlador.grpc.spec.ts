import { describe, expect, it } from 'vitest';
import { ControladorGrpcMateriais } from '../../src/modulos/materiais/materiais.controlador.grpc.js';
import { RepositorioMateriais } from '../../src/modulos/materiais/materiais.repositorio.js';
import { ServicoMateriais } from '../../src/modulos/materiais/materiais.servico.js';

describe('ControladorGrpcMateriais', () => {
  it('retorna resposta vazia quando o banco nao esta configurado', async () => {
    const servico = new ServicoMateriais(new RepositorioMateriais(null));
    const controlador = new ControladorGrpcMateriais(servico);

    const resposta = await controlador.listarMateriais({ texto_pesquisa: 'vidro' });

    expect(resposta).toEqual({ materiais: [], quantidade_total: 0 });
  });
});
