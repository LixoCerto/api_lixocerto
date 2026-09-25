import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const diretorioTeste = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(diretorioTeste, '../..');
const diretorioContratos = join(raiz, 'contratos/lixo_certo/v1');
const diretorioFonte = join(raiz, 'src');

interface RotaGrpc {
  servico: string;
  metodo: string;
}

function listarArquivos(diretorio: string): string[] {
  const arquivos: string[] = [];
  for (const nome of readdirSync(diretorio, { withFileTypes: true })) {
    const caminho = join(diretorio, nome.name);
    if (nome.isDirectory()) arquivos.push(...listarArquivos(caminho));
    else if (nome.isFile() && caminho.endsWith('.ts')) arquivos.push(caminho);
  }
  return arquivos;
}

function rotasDosContratos(): RotaGrpc[] {
  const rotas: RotaGrpc[] = [];
  for (const nome of readdirSync(diretorioContratos).filter(nome => nome.endsWith('.proto'))) {
    const conteudo = readFileSync(join(diretorioContratos, nome), 'utf8');
    const servico = conteudo.match(/service\s+(\w+)\s*\{/);
    if (!servico) continue;
    for (const correspondencia of conteudo.matchAll(/\brpc\s+(\w+)\s*\(/g)) {
      const nomeServico = servico[1];
      const nomeMetodo = correspondencia[1];
      if (nomeServico && nomeMetodo) rotas.push({ servico: nomeServico, metodo: nomeMetodo });
    }
  }
  return rotas;
}

function rotasDosControladores(): Array<RotaGrpc & { arquivo: string }> {
  const rotas: Array<RotaGrpc & { arquivo: string }> = [];
  for (const arquivo of listarArquivos(diretorioFonte)) {
    const conteudo = readFileSync(arquivo, 'utf8');
    for (const correspondencia of conteudo.matchAll(/@GrpcMethod\(['"](\w+)['"],\s*['"](\w+)['"]\)/g)) {
      const nomeServico = correspondencia[1];
      const nomeMetodo = correspondencia[2];
      if (nomeServico && nomeMetodo) rotas.push({ servico: nomeServico, metodo: nomeMetodo, arquivo });
    }
  }
  return rotas;
}

function chave(rota: RotaGrpc): string {
  return `${rota.servico}/${rota.metodo}`;
}

describe('contrato e implementação das rotas gRPC', () => {
  it('mantém todos os RPCs Protobuf implementados uma única vez', () => {
    const contratos = rotasDosContratos();
    const controladores = rotasDosControladores();
    const chavesContratos = contratos.map(chave);
    const chavesControladores = controladores.map(chave);

    expect(contratos).toHaveLength(22);
    expect(new Set(chavesContratos).size).toBe(22);
    expect(controladores).toHaveLength(22);
    expect(new Set(chavesControladores).size).toBe(22);
    expect(chavesControladores.sort()).toEqual(chavesContratos.sort());
  });

  it('mantém os 13 contratos de serviço carregados pela inicialização gRPC', () => {
    const principal = readFileSync(join(raiz, 'src/principal.ts'), 'utf8');
    const contratos = readdirSync(diretorioContratos)
      .filter(nome => nome.startsWith('servico_') && nome.endsWith('.proto'));

    expect(contratos).toHaveLength(13);
    for (const contrato of contratos) expect(principal).toContain(contrato);
  });
});
