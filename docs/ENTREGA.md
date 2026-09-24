# Entrega — API Lixo Certo

## Projeto

Diretório independente:

```text
/home/ubuntu/api-lixo-certo
```

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
- configuração de Envoy para gRPC-Web;
- Dockerfile multi-stage e Docker Compose de desenvolvimento;
- 18 migrations Sequelize no diretório `banco/migracoes/`;
- dados iniciais de papéis e permissões em `banco/dados_iniciais/`;
- teste unitário inicial do serviço de saúde;
- README com comandos e decisões técnicas.

## Migrations

```text
001_criar_lcr_usuarios.cjs
002_criar_lcr_papeis.cjs
003_criar_lcr_permissoes.cjs
004_criar_lcr_usuarios_papeis.cjs
005_criar_lcr_papeis_permissoes.cjs
006_criar_lcr_sessoes.cjs
007_criar_lcr_materiais.cjs
008_criar_lcr_pontos_coleta.cjs
009_criar_lcr_questoes.cjs
010_criar_lcr_alternativas.cjs
011_criar_lcr_tentativas_questionario.cjs
012_criar_lcr_conquistas.cjs
013_criar_lcr_usuarios_conquistas.cjs
014_criar_lcr_progresso_usuarios.cjs
015_criar_lcr_acoes_sustentaveis.cjs
016_criar_lcr_sessoes_avaliacao.cjs
017_criar_lcr_respostas_sus.cjs
018_criar_lcr_registros_auditoria.cjs
```

As 18 migrations foram verificadas quanto à existência de `createTable`, ao prefixo dos campos, às referências e à ordem das dependências. Nenhuma migration foi executada em banco real nesta etapa, pois não havia PostgreSQL local disponível e não foi autorizado usar o banco do protótipo web.

## Validações executadas

```text
pnpm contratos:validar  OK
pnpm tipos              OK
pnpm testar             OK — 1 teste aprovado
pnpm compilar           OK
node --check migrations OK
validação LCR           OK — 18 migrations e 18 tabelas
```

## Próxima etapa segura

Antes de executar `pnpm migrar`, deve-se iniciar um PostgreSQL separado para a nova API, configurar uma cópia local de `.env.exemplo` e revisar as migrations em conjunto com a orientação. O banco do protótipo `lixo-certo-web` não deve ser reutilizado pela nova API.
