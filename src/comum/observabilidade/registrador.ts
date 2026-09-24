export function registrarEvento(nomeEvento: string, dados: Record<string, unknown> = {}): void {
  const dadosSemSegredos = Object.fromEntries(
    Object.entries(dados).filter(([chave]) => !/(token|senha|segredo|authorization)/i.test(chave)),
  );
  console.info(JSON.stringify({ nomeEvento, ...dadosSemSegredos, data: new Date().toISOString() }));
}
