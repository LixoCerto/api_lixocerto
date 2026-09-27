# Entrega — API Lixo Certo

## Projeto

A API foi criada em português, usando a sigla de três letras `LCR` para o projeto Lixo Certo.

## Convenção aplicada

Tabelas:

```text
lcr_nome_da_tabela
```

Campos:

```text
lcr_sigla_tabela_nome_do_campo
```

Exemplos:

```text
lcr_usuarios
lcr_usr_id_usuario
lcr_mat_nome_material
lcr_pco_status_verificacao
```

## Conteúdo criado

- projeto NestJS com TypeScript estrito;
- contratos gRPC em Protocol Buffers em `contratos/`;
- geração Buf configurada;
- PostgreSQL configurado para Sequelize;
- Redis configurado para cache e controles temporários;
- módulos separados de autenticação, autorização, usuários, papéis, permissões, sessões, auditoria, materiais, pontos de coleta, questionários, gamificação, desafios, perfil, avaliação de usabilidade, administração e saúde;
- 21 migrations Sequelize no diretório `banco/migracoes/`;
- dados iniciais de papéis, permissões e desafios em `banco/dados_iniciais/`;
- testes unitários, integração PostgreSQL/Redis e E2E gRPC;
- definição raiz Protobuf, ambiente e catálogo dos 26 métodos para criação de requisições gRPC nativas no Postman em `docs/postman/`; a coleção nativa é salva pelo cliente Postman;
- configuração de ambiente sem credenciais reais em `.env.exemplo`.

A gestão Docker foi retirada da API e está no projeto separado `infra_lixocerto`, responsável pelo Redis local. O PostgreSQL da aplicação é externo e configurado por `URL_BANCO_DADOS`.

## Migrations

As migrations `001` a `021` criam usuários, papéis, permissões, sessões, materiais, pontos de coleta, questionários, gamificação, avaliação SUS, auditoria e desafios.

## Validações

```text
pnpm contratos:validar  OK
pnpm tipos              OK
pnpm testar             OK — 24 testes unitários
pnpm testar:integracao  OK — PostgreSQL e Redis isolados
pnpm testar:e2e         OK — gRPC de saúde
pnpm compilar           OK
```

## Operação

1. Iniciar o Redis pelo projeto `infra_lixocerto`.
2. Configurar o `.env` local da API com PostgreSQL externo e Redis local.
3. Confirmar a preparação do banco externo antes de migrations.
4. Executar a API diretamente com `pnpm desenvolver`.
