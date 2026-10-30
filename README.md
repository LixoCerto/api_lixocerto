# LixoCerto — API

API de domínio da plataforma **LixoCerto**. Centraliza autenticação, autorização e as regras dos serviços de orientação ambiental, participação e administração, expondo contratos gRPC para os clientes autorizados.

> **Status:** em desenvolvimento. A presença de um módulo no código ou a aprovação de testes automatizados não implica validação de todos os fluxos, operação em produção ou avaliação com participantes. Consulte o escopo de cada teste e a documentação dos fluxos antes de utilizá-los.

## Visão geral

| Área | Tecnologia ou responsabilidade |
|---|---|
| API | NestJS 11, Node.js 22 e TypeScript |
| Contratos | gRPC e Protocol Buffers, com validação e geração via Buf |
| Persistência | PostgreSQL e Sequelize; alterações de esquema por migrations explícitas |
| Sessão e cache | JWT, refresh tokens e Redis |
| Arquivos | filesystem ou armazenamento compatível com S3, conforme configuração |
| E-mail | fluxos transacionais de confirmação e recuperação, com provedor configurado no ambiente |

O navegador acessa a API por gRPC-Web através do Envoy no repositório de infraestrutura. O PostgreSQL é externo ao Compose: ele deve estar disponível e configurado antes de executar migrations ou iniciar a aplicação integrada.

## Funcionalidades organizadas

A API contém módulos para contas, sessões, papéis e permissões, auditoria, materiais educativos, pontos de coleta, questionários, pontuação, desafios, perfil, pesquisa de experiência e administração. O contrato gRPC fica em [`contratos/lixo_certo/v1`](contratos/lixo_certo/v1/servico_autenticacao.proto) e a documentação complementar em [`docs/`](docs/).

A autenticação oferece cadastro e login próprios, confirmação de e-mail, recuperação de senha e renovação/revogação de sessão. O login Google valida no backend o ID token enviado pelo Google Identity Services, incluindo audiência e nonce. Para esse fluxo é necessário configurar `GOOGLE_OAUTH_CLIENT_ID`; o Client Secret não é utilizado.

## Requisitos

- Node.js 22;
- pnpm 10.4.1, ativado pelo Corepack;
- PostgreSQL acessível para executar a API e as migrations;
- Redis acessível para cache e controles de sessão/rate-limit;
- Envoy e frontend, quando for testar o fluxo integrado pelo navegador.

## Configuração local

Na raiz deste repositório:

```bash
corepack enable
corepack prepare pnpm@10.4.1 --activate
pnpm install --frozen-lockfile
cp .env.exemplo .env
```

No PowerShell, o último comando pode ser substituído por:

```powershell
Copy-Item .env.exemplo .env
```

Preencha o `.env` com as configurações do **ambiente de desenvolvimento**, usando [`.env.exemplo`](.env.exemplo) como referência. Não coloque credenciais reais no Git, em capturas de tela ou em mensagens. Para o fluxo Google, configure o mesmo Client ID web no frontend e na API. O Client ID é uma configuração pública; chaves de e-mail, senhas de banco, tokens e segredos JWT são privados.

As variáveis estão agrupadas por finalidade: `BANCO_DADOS_*`, `REDIS_*` e `REDIS_TESTE_*`, `SEGREDO_*`, `GOOGLE_OAUTH_CLIENT_ID`, `PROVEDOR_EMAIL`, `RESEND_CHAVE_API`, `EMAIL_REMETENTE`, `ORIGENS_PERMITIDAS` e `URL_PUBLICA_FRONTEND`. Os valores concretos dependem do ambiente e devem ser mantidos fora do repositório.

## Desenvolvimento e validação

| Comando | Finalidade |
|---|---|
| `pnpm desenvolver` | Inicia a API em modo de desenvolvimento |
| `pnpm contratos:validar` | Valida os contratos Protobuf com Buf |
| `pnpm contratos:gerar` | Gera os artefatos dos contratos após uma alteração deliberada no `.proto` |
| `pnpm tipos` | Verifica os tipos TypeScript |
| `pnpm testar` | Executa os testes unitários |
| `pnpm testar:integracao` | Executa testes de integração; requer serviços e configuração de teste |
| `pnpm testar:e2e` | Compila a API e executa os testes ponta a ponta; requer configuração de teste |
| `pnpm compilar` | Compila a aplicação |

Para uma verificação local padrão:

```bash
pnpm contratos:validar
pnpm tipos
pnpm testar
pnpm compilar
```

Execute testes de integração e ponta a ponta somente com a configuração de teste e serviços locais descartáveis. Nunca aponte testes ou fixtures para um banco com dados importantes.

A API escuta gRPC na porta `50051` por padrão. No ambiente Compose, o acesso do navegador passa pelo Envoy; consulte o repositório [`infra_lixocerto`](https://github.com/LixoCerto/infra_lixocerto).

## Banco de dados

A estrutura do banco é controlada por migrations; a aplicação não deve depender de `sequelize.sync()`. Confirme que o `.env` aponta para uma base descartável de desenvolvimento ou teste antes de executar:

```bash
pnpm migrar
pnpm semear
```

`pnpm semear:homologacao` destina-se ao conjunto de dados de homologação. Migrations e seeds não são executados automaticamente ao iniciar o servidor. Faça backup antes de qualquer operação sobre uma base importante e não use dados de desenvolvimento em produção.

## Segurança e configuração

- Mantenha `.env` fora do controle de versão e use valores fictícios nos exemplos.
- Gere segredos fortes e distintos por ambiente; não reutilize chaves entre desenvolvimento e produção.
- Restrinja CORS às origens necessárias e mantenha a autorização definitiva no backend.
- Não habilite gRPC reflection fora dos contextos em que ela for intencionalmente necessária.
- O fluxo Google não precisa de Client Secret: valide os tokens exclusivamente no servidor com o Client ID configurado.
- Antes de qualquer implantação, revise TLS do banco, configuração de e-mail, armazenamento e política de backup para o ambiente-alvo.

## Documentação relacionada

- [Configuração de desenvolvimento](docs/CONFIGURACAO_DESENVOLVIMENTO.md)
- [Fluxos de e-mail e autenticação](docs/FLUXOS_EMAIL_AUTENTICACAO.md)
- [Operação, privacidade e backup](docs/OPERACAO_PRIVACIDADE_E_BACKUP.md)
- [Catálogo do guia de descarte](docs/catalogo-guia-descarte.md)
- [Frontend da plataforma](https://github.com/LixoCerto/frontend_lixocerto)
- [Infraestrutura Docker](https://github.com/LixoCerto/infra_lixocerto)
