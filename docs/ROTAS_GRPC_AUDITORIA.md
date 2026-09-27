# Auditoria das rotas gRPC do backend Lixo Certo

## Resultado geral

A auditoria confirma que o backend expõe **13 serviços gRPC e 26 métodos RPC**. Todos os RPCs declarados nos contratos Protobuf possuem um controlador NestJS correspondente, sem duplicidades.

A API continua sendo exclusivamente gRPC. No Postman, as operações devem ser requisições gRPC nativas com o botão **Invoke**.

## Autenticação própria

A API não depende de Keycloak ou OIDC. O serviço de autenticação usa:

- cadastro local;
- senha armazenada somente como hash `scrypt`;
- JWT de acesso assinado com `SEGREDO_JWT`;
- token de atualização aleatório armazenado somente como hash;
- sessões persistidas em `lcr_sessoes`;
- papéis e permissões carregados do PostgreSQL;
- revogação de sessão e rotação de refresh token.

A API não armazena a senha original e não retorna tokens em RPCs de sessão.

## Serviço de autenticação

| Serviço | Método | Autenticação | Função |
|---|---|---|---|
| `ServicoAutenticacao` | `CadastrarUsuario` | Pública | Cria uma conta com o papel padrão `usuario` e retorna os tokens. |
| `ServicoAutenticacao` | `Entrar` | Pública | Valida e-mail e senha e cria uma sessão. |
| `ServicoAutenticacao` | `RenovarToken` | Token de atualização | Rotaciona o token de acesso e o token de atualização. |
| `ServicoAutenticacao` | `Sair` | Token de atualização | Revoga a sessão associada ao token de atualização. |
| `ServicoAutenticacao` | `ObterIdentidadeAtual` | Bearer JWT | Retorna identidade, papéis e permissões da sessão atual. |

Para chamadas protegidas, configure no metadado gRPC:

```text
authorization: Bearer {{jwt_token}}
```

Para renovar ou sair, use o campo `token_atualizacao` retornado por `CadastrarUsuario` ou `Entrar`. O Postman deve manter esse valor apenas no ambiente local.

## Matriz completa dos 26 RPCs

| Nº | Serviço | Método | Autenticação | Permissão ou regra |
|---:|---|---|---|---|
| 1 | `ServicoSaude` | `Verificar` | Pública | Nenhuma |
| 2 | `ServicoAutenticacao` | `CadastrarUsuario` | Pública | Nome, e-mail e senha válidos |
| 3 | `ServicoAutenticacao` | `Entrar` | Pública | Credenciais válidas |
| 4 | `ServicoAutenticacao` | `RenovarToken` | Token de atualização | Sessão ativa e não expirada |
| 5 | `ServicoAutenticacao` | `Sair` | Token de atualização | Revoga a sessão correspondente |
| 6 | `ServicoAutenticacao` | `ObterIdentidadeAtual` | Bearer JWT | Usuário e sessão ativos |
| 7 | `ServicoIdentidade` | `ObterIdentidadeInterna` | Bearer JWT | Usuário ativo |
| 8 | `ServicoMateriais` | `ListarMateriais` | Pública | Filtros de texto, categoria e paginação |
| 9 | `ServicoPontosColeta` | `ListarPontosColeta` | Pública | Cidade e categoria do material |
| 10 | `ServicoQuestionarios` | `ListarQuestoes` | Pública | Paginação |
| 11 | `ServicoQuestionarios` | `EnviarRespostaQuestionario` | Pública | Questão e alternativa válidas |
| 12 | `ServicoGamificacao` | `ObterProgressoUsuario` | Pública | Identificador opcional para progresso |
| 13 | `ServicoGamificacao` | `ObterRanking` | Pública | Limite de resultados |
| 14 | `ServicoDesafios` | `ListarDesafios` | Bearer JWT | Usuário interno existente |
| 15 | `ServicoDesafios` | `ParticiparDesafio` | Bearer JWT | Usuário interno e rate limit |
| 16 | `ServicoDesafios` | `RegistrarAcaoSustentavel` | Bearer JWT | Usuário interno e rate limit |
| 17 | `ServicoAvaliacaoUsabilidade` | `EnviarAvaliacaoSus` | Pública | Consentimento e notas válidas |
| 18 | `ServicoAvaliacaoUsabilidade` | `ObterResultadosAgregados` | Bearer JWT | `avaliacao_usabilidade:consultar_agregados` |
| 19 | `ServicoPerfil` | `ObterPerfilAtual` | Bearer JWT | Usuário ativo |
| 20 | `ServicoPerfil` | `AtualizarPerfil` | Bearer JWT | Usuário ativo |
| 21 | `ServicoSessoes` | `ListarSessoes` | Bearer JWT | Usuário autenticado |
| 22 | `ServicoSessoes` | `RevogarSessao` | Bearer JWT | Somente sessão do próprio usuário |
| 23 | `ServicoSessoes` | `RevogarTodasSessoes` | Bearer JWT | Somente sessões do próprio usuário |
| 24 | `ServicoAuditoria` | `RegistrarEventoAuditoria` | Bearer JWT | Usuário interno |
| 25 | `ServicoAuditoria` | `ListarAuditoria` | Bearer JWT | `auditoria:consultar` |
| 26 | `ServicoAdministracao` | `ObterResumoAdministrativo` | Bearer JWT | `administracao:consultar` |

Dos 26 RPCs, **12 são públicos** e **14 exigem Bearer JWT**. Os quatro RPCs de ciclo de sessão usam o token de atualização conforme descrito acima.

## Contrato versus implementação

A comparação automatizada confronta:

- os `rpc` declarados em `contratos/lixo_certo/v1/*.proto`;
- os decorators `@GrpcMethod` em `src/modulos/**/*.controlador.grpc.ts`;
- os contratos carregados em `src/principal.ts`;
- os módulos importados em `src/modulo_principal.ts`.

Resultado esperado:

| Verificação | Resultado |
|---|---:|
| Serviços Protobuf | **13/13** |
| Métodos RPC declarados | **26/26** |
| Métodos com controlador correspondente | **26/26** |
| Métodos ausentes | **0** |
| Métodos duplicados | **0** |
| Métodos não declarados no Protobuf | **0** |

## Banco e segurança

A migration `022_adicionar_lcr_hash_senha_usuario.cjs` adiciona o campo `lcr_usr_hash_senha` à tabela `lcr_usuarios`. O campo aceita `NULL` para preservar usuários criados pela estrutura anterior; novas contas locais sempre recebem hash de senha.

O segredo JWT deve possuir pelo menos 32 caracteres em produção. O arquivo `.env` real permanece local e nunca deve ser versionado.

## Validações

```powershell
pnpm tipos
pnpm compilar
pnpm contratos:validar
pnpm testar
```

No ambiente Docker, mantenha o smoke público e acrescente chamadas autenticadas usando um token obtido pelos RPCs `CadastrarUsuario` ou `Entrar`.
