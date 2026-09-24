# Etapa 4.11 — Segurança final e testes E2E gRPC

A etapa adicionou um teste E2E que compila e inicia o microserviço real, carrega o contrato Protobuf de saúde, conecta por gRPC e executa `ServicoSaude.Verificar`. A resposta confirma o serviço saudável e a disponibilidade efetiva de PostgreSQL e Redis.

O mesmo teste verifica que o segredo de integração não aparece nos logs do processo. Também foi adicionado um cenário de integração que tenta revogar a sessão de um usuário usando a identidade de outra conta; a operação é recusada, confirmando o isolamento por usuário.

O comando reproduzível da etapa é:

```bash
pnpm testar:e2e
```

Esse comando recompila a API e executa o cliente gRPC contra o servidor compilado em uma porta isolada.

## Validação da etapa

| Verificação | Resultado |
|---|---|
| Testes unitários | 24 aprovados |
| Testes de integração | 4 aprovados |
| Teste E2E gRPC | 1 aprovado |
| Health PostgreSQL/Redis por gRPC | Aprovado |
| Segredo ausente dos logs | Aprovado |
| Isolamento de revogação de sessão | Aprovado |
| TypeScript e compilação | Aprovados |

A etapa foi publicada em commit separado no GitHub.
