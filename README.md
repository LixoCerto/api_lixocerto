# API Lixo Certo

API independente do projeto Lixo Certo, com NestJS, TypeScript, gRPC, Protocol Buffers, PostgreSQL, Sequelize, Redis e Envoy.

## Convenções

Os identificadores do domínio usam português sem acentos e seguem o padrão `LCR`:

- tabelas: `lcr_nome_da_tabela`;
- campos: `lcr_sigla_tabela_nome_do_campo`;
- chaves, índices e restrições: `pk_lcr_...`, `fk_lcr_...`, `uq_lcr_...` e `ix_lcr_...`.

## Comandos

```bash
pnpm install
pnpm contratos:validar
pnpm contratos:gerar
pnpm tipos
pnpm testar
pnpm compilar
pnpm migrar
```

As migrations exigem PostgreSQL disponível e uma variável `URL_BANCO_DADOS` configurada. O projeto não utiliza `sequelize.sync()`; a estrutura do banco é controlada exclusivamente por migrations.

## Segurança

A API foi organizada para autenticação OIDC/JWT, autorização por papel e permissão, rate limiting via Redis, auditoria, validação de contratos, deadlines gRPC, TLS no gateway e execução em container sem privilégios. Os controles de produção devem ser configurados antes da publicação.

## Ordem dos domínios

A primeira entrega contém identidade, autenticação, autorização, usuários, papéis, permissões, sessões, auditoria, materiais, pontos de coleta, questionários, gamificação, desafios, perfil, avaliação de usabilidade, administração e saúde.
