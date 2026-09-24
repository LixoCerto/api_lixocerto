const CHAVES_SENSIVEIS = /(token|senha|segredo|authorization|cookie|refresh)/i;

function sanitizar(chave: string, valor: unknown): unknown {
  if (CHAVES_SENSIVEIS.test(chave)) return '[REDACTED]';
  if (typeof valor === 'string') return valor.length > 500 ? `${valor.slice(0, 500)}...[truncado]` : valor;
  if (Array.isArray(valor)) return valor.slice(0, 20).map(item => sanitizar(chave, item));
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).slice(0, 30).map(([nome, item]) => [nome, sanitizar(nome, item)]));
  }
  return valor;
}

export function registrarEvento(nomeEvento: string, dados: Record<string, unknown> = {}): void {
  const dadosSemSegredos = Object.fromEntries(
    Object.entries(dados).slice(0, 50).map(([chave, valor]) => [chave, sanitizar(chave, valor)]),
  );
  console.info(JSON.stringify({ nomeEvento, ...dadosSemSegredos, data: new Date().toISOString() }));
}
