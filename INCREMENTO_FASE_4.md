# Incremento da Fase 4 — Núcleo funcional

## Implementado

- modelos Sequelize de usuários, papéis, permissões, materiais e pontos de coleta;
- inicialização dos modelos sem `sequelize.sync()`;
- verificação JWT/OIDC com emissor, audiência, JWKS e algoritmos permitidos;
- extração obrigatória de token Bearer;
- sincronização do usuário externo com `lcr_usuarios`;
- atribuição automática do papel `usuario` quando necessário;
- carregamento canônico de papéis e permissões a partir do PostgreSQL;
- política de autorização separada do nível de gamificação;
- busca paginada de materiais publicados;
- consulta de pontos de coleta somente com status `verificado`;
- regra de níveis de gamificação sem privilégios administrativos;
- métodos gRPC para identidade, materiais e pontos de coleta;
- testes unitários de autenticação, autorização, materiais, saúde e gamificação.

## Validação

```text
pnpm tipos       OK
pnpm testar      OK — 6 testes aprovados
pnpm compilar    OK
pnpm contratos:validar OK
bootstrap gRPC   OK — Nest microservice successfully started
```

## Limites atuais

O fluxo OIDC depende de `EMISSOR_OIDC`, `AUDIENCIA_OIDC` e `ENDERECO_JWKS` no ambiente. As consultas Sequelize retornam vazio quando o banco não está configurado, evitando dados falsos e permitindo testes unitários isolados. A execução das migrations continua pendente de um PostgreSQL separado da API.
