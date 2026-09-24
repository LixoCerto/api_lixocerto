# Incremento da Fase 4.4 — Integração de infraestrutura

## Resultado

A API foi validada contra um PostgreSQL 16 local e um Redis 7 local, ambos separados do banco do webapp. As dezoito migrations foram executadas com sucesso, as tabelas LCR foram criadas e o seed passou a inserir quatro papéis, dez permissões e vinte e quatro relações entre papéis e permissões.

A auditoria identificou e corrigiu duas pendências. A primeira era a ausência das relações de autorização no seed. A segunda era o formato incompleto dos UUIDs artificiais dessas relações. Depois da correção, o seed foi aplicado, desfeito e reaplicado com sucesso.

O módulo de cache agora disponibiliza `ServicoCache`, que centraliza leitura, escrita com TTL entre 1 e 86.400 segundos, remoção e verificação de conectividade. Quando Redis não está configurado, o serviço retorna fallback seguro para operações de leitura e informa indisponibilidade nas operações de escrita.

## Testes de integração

O teste PostgreSQL cria um usuário, confirma que o papel `usuario` e suas permissões são carregados do banco, verifica que materiais publicados são retornados e que rascunhos são ocultados. Também confirma que apenas pontos de coleta verificados aparecem na consulta pública.

O teste Redis valida `PING`, escrita, leitura, remoção e rejeição de TTL inválido. O teste utiliza a base lógica 15 e uma chave aleatória por execução.

## Validação executada

| Verificação | Resultado |
|---|---|
| Migrations 001–018 | Aprovadas |
| Rollback das migrations | Aprovado; zero tabelas LCR restantes |
| Seed e rollback do seed | Aprovados |
| Relações papel–permissão | 24 relações persistidas |
| Contratos Protobuf | Aprovados |
| TypeScript | Aprovado |
| Testes unitários | Aprovados |
| Testes de integração | 2 testes aprovados |
| Compilação | Aprovada |
| Bootstrap do microserviço gRPC | Aprovado |

## Comandos reproduzíveis

```bash
pnpm integracao:banco
pnpm testar
pnpm testar:integracao
pnpm contratos:validar
pnpm tipos
pnpm compilar
```

As variáveis `URL_BANCO_DADOS_TESTE` e `URL_REDIS_TESTE` devem apontar para serviços de teste separados. Nenhum segredo de produção foi incluído no repositório.
