# Configuração de desenvolvimento — API Lixo Certo

Este documento descreve o ambiente local da API para desenvolvimento, testes de migrations, PostgreSQL, Redis e autenticação OIDC. **Não coloque tokens, senhas reais ou arquivos `.env` no Git.**

## Arquivo local

Crie, na raiz do projeto, um arquivo chamado `.env` e preencha-o com:

```env
AMBIENTE_EXECUCAO=desenvolvimento
VERSAO_API=0.1.0
PORTA_GRPC=50051

URL_BANCO_DADOS=postgres://lixo_certo:alterar_senha_local@127.0.0.1:5432/lixo_certo
URL_BANCO_DADOS_TESTE=postgres://lcr_integracao:lcr_integracao_local@127.0.0.1:5432/lcr_integracao

URL_REDIS=redis://127.0.0.1:6379
URL_REDIS_TESTE=redis://127.0.0.1:6379/15
ORIGENS_PERMITIDAS=http://localhost:3000

# Substituir pelos dados reais do provedor OIDC antes de testar login com JWT.
EMISSOR_OIDC=https://seu-provedor-oidc.local
AUDIENCIA_OIDC=lixo-certo-api
ENDERECO_JWKS=https://seu-provedor-oidc.local/.well-known/jwks.json

SEGREDO_HASH_PARTICIPANTE=LCR_DEV_SEGREDO_HASH_2026_32_CARACTERES_MINIMO
CAMINHO_PROTO=contratos/lixo_certo/v1/servico_saude.proto
```

Os campos `EMISSOR_OIDC`, `AUDIENCIA_OIDC` e `ENDERECO_JWKS` são apenas placeholders neste exemplo. Para validar tokens, eles devem apontar para o emissor, a audiência e o endpoint JWKS reais. O segredo de anonimização deve possuir pelo menos 32 caracteres.

## PostgreSQL e Redis

O projeto possui um Compose local em `implantacao/docker-compose.yml`. Para iniciar as dependências:

```powershell
docker compose -f implantacao\docker-compose.yml up -d banco cache
```

Para executar a API fora do container, use `127.0.0.1` nas URLs. Para executar a API dentro do Compose, use os nomes dos serviços:

```env
URL_BANCO_DADOS=postgres://lixo_certo:alterar_senha_local@banco:5432/lixo_certo
URL_REDIS=redis://cache:6379
```

## Fluxo recomendado

```powershell
pnpm install
pnpm migrar
pnpm semear
pnpm tipos
pnpm testar
pnpm compilar
pnpm desenvolvimento
```

A porta gRPC padrão é `50051`. Navegadores não consomem diretamente gRPC tradicional; o frontend deve utilizar um gateway Connect/gRPC-Web ou Envoy para encaminhar chamadas à API.
