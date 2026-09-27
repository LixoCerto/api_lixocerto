# Configuração de desenvolvimento — API Lixo Certo

A API é executada diretamente com Node/NestJS. A gestão de containers foi removida deste repositório e está centralizada no projeto `infra_lixocerto`.

## Arquivo local

Crie `.env` a partir de `.env.exemplo`. O arquivo real é local e não deve ser versionado.

```env
AMBIENTE_EXECUCAO=desenvolvimento
VERSAO_API=0.1.0
PORTA_GRPC=50051

# PostgreSQL externo; não usar o PostgreSQL do projeto de infraestrutura.
BANCO_DADOS_HOST=177.223.51.10
BANCO_DADOS_PORTA=5432
BANCO_DADOS_USUARIO=postgres
BANCO_DADOS_SENHA=SENHA_LOCAL
BANCO_DADOS_NOME=lixocerto
BANCO_DADOS_TESTE_HOST=177.223.51.10
BANCO_DADOS_TESTE_PORTA=5432
BANCO_DADOS_TESTE_USUARIO=postgres
BANCO_DADOS_TESTE_SENHA=SENHA_LOCAL
BANCO_DADOS_TESTE_NOME=lixocerto_teste

# Redis local gerenciado por ../infra_lixocerto.
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=SENHA_REDIS_LOCAL
REDIS_DB=0
REDIS_TESTE_HOST=127.0.0.1
REDIS_TESTE_PORT=6379
REDIS_TESTE_PASSWORD=SENHA_REDIS_LOCAL
REDIS_TESTE_DB=15
ORIGENS_PERMITIDAS=http://localhost:3000

# Autenticação própria da API; gere um valor aleatório com pelo menos 32 caracteres.
SEGREDO_JWT=gerar-com-secrets-manager-com-no-minimo-32-caracteres
EMISSOR_JWT=lixo-certo-api
AUDIENCIA_JWT=lixo-certo-client
SEGREDO_HASH_PARTICIPANTE=gerar-com-secrets-manager-com-no-minimo-32-caracteres
CAMINHO_PROTO=contratos/lixo_certo/v1/servico_saude.proto
```

As senhas são informadas diretamente em variáveis separadas; use um gerenciador de segredos em produção. Nunca copie a senha do banco ou do Redis para o GitHub, Postman ou frontend.

## Infraestrutura

Na pasta irmã `infra_lixocerto`, inicie somente o Redis:

```powershell
.\scripts\iniciar.ps1
.\scripts\status.ps1
```

O PostgreSQL é externo e não é criado, migrado ou destruído pela infraestrutura local. Antes de executar migrations, confirme que o banco remoto está preparado, incluindo a extensão `pgcrypto` exigida pelo schema.

## Execução da API

```powershell
pnpm install
pnpm contratos:validar
pnpm tipos
pnpm testar
pnpm compilar
pnpm migrar
pnpm semear
pnpm desenvolver
```

A porta gRPC padrão é `50051`. O frontend deve utilizar Connect/gRPC-Web ou um gateway apropriado para consumo pelo navegador. O ciclo de conta local usa `CadastrarUsuario`, `Entrar`, `RenovarToken` e `Sair`; as chamadas protegidas usam `authorization: Bearer <token_acesso>`.

## Testes

Use um banco de testes separado em `BANCO_DADOS_TESTE_HOST/PORTA/USUARIO/SENHA/NOME`. Não execute os testes de integração apontando para o banco externo principal, pois eles criam e removem registros de teste.
