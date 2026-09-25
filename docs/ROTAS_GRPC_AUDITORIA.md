# Auditoria das rotas gRPC do backend Lixo Certo

## Resultado geral

A auditoria confirmou que o backend expõe **13 serviços gRPC e 22 métodos RPC**. Todos os 22 métodos declarados nos contratos Protobuf possuem um controlador NestJS com `@GrpcMethod` correspondente. Não foram encontrados RPCs sem implementação, implementações duplicadas ou métodos implementados fora dos contratos.

A API é um microserviço gRPC. Ela não expõe rotas REST `GET`, `POST`, `PUT` ou `DELETE`. No Postman, as operações devem aparecer como requisições gRPC nativas com o botão **Invoke**.

A autenticação não possui uma rota de login local. O login é delegado a um provedor externo compatível com OIDC. Dentro da API, o método gRPC `ServicoAutenticacao/ObterIdentidadeAtual` recebe um Bearer JWT, valida o token, sincroniza o usuário no banco e devolve a identidade, os papéis e as permissões.

## Serviço de autenticação

O único RPC do serviço de autenticação é:

| Serviço | Método | Entrada | Autenticação | Função |
|---|---|---|---|---|
| `ServicoAutenticacao` | `ObterIdentidadeAtual` | `{}` | Bearer JWT obrigatório | Valida o token OIDC, sincroniza o usuário e retorna identidade, papéis e permissões. |

O token deve ser enviado no metadado gRPC abaixo:

```text
authorization: Bearer {{jwt_token}}
```

A API não gera o JWT. O frontend inicia o fluxo Authorization Code com PKCE usando `oidc-client-ts`, recebe o `access_token` do provedor OIDC e o utiliza nas chamadas protegidas da API.

## Matriz completa dos 22 RPCs

| Nº | Serviço | Método | Autenticação | Permissão adicional | Mensagem principal |
|---:|---|---|---|---|---|
| 1 | `ServicoSaude` | `Verificar` | Pública | Nenhuma | `{}` |
| 2 | `ServicoAutenticacao` | `ObterIdentidadeAtual` | Bearer JWT | Nenhuma | `{}` |
| 3 | `ServicoIdentidade` | `ObterIdentidadeInterna` | Bearer JWT | Usuário ativo | `{}` |
| 4 | `ServicoMateriais` | `ListarMateriais` | Pública | Nenhuma | Filtros de texto, categoria e paginação. |
| 5 | `ServicoPontosColeta` | `ListarPontosColeta` | Pública | Nenhuma | Cidade e categoria do material. |
| 6 | `ServicoQuestionarios` | `ListarQuestoes` | Pública | Nenhuma | Paginação. |
| 7 | `ServicoQuestionarios` | `EnviarRespostaQuestionario` | Pública | Nenhuma | `id_questao` e `id_alternativa`; `x-id-usuario-externo` é opcional para registrar progresso. |
| 8 | `ServicoGamificacao` | `ObterProgressoUsuario` | Pública | Nenhuma | `x-id-usuario-externo` opcional. Sem ele, retorna progresso inicial. |
| 9 | `ServicoGamificacao` | `ObterRanking` | Pública | Nenhuma | Limite de resultados. |
| 10 | `ServicoDesafios` | `ListarDesafios` | Bearer JWT | Usuário interno existente | Paginação. |
| 11 | `ServicoDesafios` | `ParticiparDesafio` | Bearer JWT | Usuário interno e rate limit | `id_desafio`. |
| 12 | `ServicoDesafios` | `RegistrarAcaoSustentavel` | Bearer JWT | Usuário interno e rate limit | `id_desafio`, `tipo_acao` e `descricao_acao`. |
| 13 | `ServicoAvaliacaoUsabilidade` | `EnviarAvaliacaoSus` | Pública | Consentimento e notas válidas | Código do participante, consentimento e 10 notas. |
| 14 | `ServicoAvaliacaoUsabilidade` | `ObterResultadosAgregados` | Bearer JWT | `avaliacao_usabilidade:consultar_agregados` | `{}` |
| 15 | `ServicoPerfil` | `ObterPerfilAtual` | Bearer JWT | Usuário ativo | `{}` |
| 16 | `ServicoPerfil` | `AtualizarPerfil` | Bearer JWT | Usuário ativo | `nome_usuario`. |
| 17 | `ServicoSessoes` | `ListarSessoes` | Bearer JWT | Usuário autenticado | `{}`; `x-id-sessao` é opcional para marcar a sessão atual. |
| 18 | `ServicoSessoes` | `RevogarSessao` | Bearer JWT | Usuário autenticado | `id_sessao`. |
| 19 | `ServicoSessoes` | `RevogarTodasSessoes` | Bearer JWT | Usuário autenticado | `{}` |
| 20 | `ServicoAuditoria` | `RegistrarEventoAuditoria` | Bearer JWT | Usuário interno | Tipo do evento, recurso e correlação. |
| 21 | `ServicoAuditoria` | `ListarAuditoria` | Bearer JWT | `auditoria:consultar` | Tipo do evento e limite. |
| 22 | `ServicoAdministracao` | `ObterResumoAdministrativo` | Bearer JWT | `administracao:consultar` | `{}` |

Dos 22 RPCs, **8 são públicos** e **14 exigem Bearer JWT**. Entre os métodos protegidos, os serviços de autorização ainda verificam permissões específicas quando a operação exige acesso administrativo ou consulta de auditoria.

## Contrato versus implementação

A comparação automatizada foi realizada entre:

- os `rpc` declarados em `contratos/lixo_certo/v1/*.proto`;
- os decorators `@GrpcMethod` presentes em `src/modulos/**/*.controlador.grpc.ts`;
- os contratos carregados em `src/principal.ts`;
- os módulos importados em `src/modulo_principal.ts`.

Resultado:

| Verificação | Resultado |
|---|---:|
| Serviços Protobuf | **13/13** |
| Métodos RPC declarados | **22/22** |
| Métodos com controlador correspondente | **22/22** |
| Métodos ausentes | **0** |
| Métodos duplicados | **0** |
| Métodos não declarados no Protobuf | **0** |
| Serviços descobertos por server reflection no Docker | **13** |
| Smoke tests públicos no notebook | **5/5** |

Também foi adicionado o teste automatizado `testes/unidade/rotas_grpc.spec.ts`, que falha caso um RPC seja adicionado ao Protobuf sem controlador correspondente ou caso a inicialização deixe de carregar um contrato de serviço.

## Módulos internos sem rota RPC própria

Os módulos de usuários, papéis, permissões e autorização estão registrados no backend, mas não expõem RPCs públicos próprios neste contrato. Eles funcionam como componentes internos utilizados pelos controladores e serviços de autenticação, autorização e domínio.

Isso explica por que existem módulos NestJS adicionais sem aparecer como novos serviços no Postman. O Postman apresenta somente métodos declarados nos contratos Protobuf e registrados pelo transporte gRPC.

## Conclusão sobre os erros do Postman

As capturas com `16 UNAUTHENTICATED` são chamadas válidas que chegaram ao backend sem o metadado `authorization`. Elas não indicam rota ausente, erro de URL ou falha do Postman.

Para os 14 métodos protegidos, configure no Postman:

| Key | Value |
|---|---|
| `authorization` | `Bearer {{jwt_token}}` |

O valor de `jwt_token` precisa ser um `access_token` real emitido pelo provedor OIDC configurado. O arquivo de ambiente do Postman deixa esse campo vazio de propósito. Sem um provedor OIDC configurado, não existe JWT válido disponível para executar os métodos protegidos.

## Validações recomendadas

No projeto da API:

```powershell
pnpm tipos
pnpm compilar
pnpm contratos:validar
pnpm testar
```

No projeto de infraestrutura:

```powershell
.\scripts\testar.ps1
```

O resultado esperado no notebook é:

```text
Smoke gRPC: 5/5 aprovados em 127.0.0.1:50051
Server reflection gRPC: 13 serviços descobertos em 127.0.0.1:50051
```

## Referências

[1]: https://github.com/LixoCerto/api_lixocerto "Repositório da API Lixo Certo"
[2]: https://github.com/LixoCerto/infra_lixocerto "Repositório da infraestrutura Lixo Certo"
[3]: https://learning.postman.com/docs/use/send-requests/protocols/grpc/grpc-request-interface "Postman — interface de requisição gRPC"
