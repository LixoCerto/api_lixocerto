# Incremento da Fase 4.5 — Desafios, auditoria e proteção contra abuso

## Domínio de desafios

Foram adicionadas as migrations 019, 020 e 021. A primeira cria `lcr_desafios`, a segunda cria `lcr_usuarios_desafios` e a terceira vincula opcionalmente uma ação sustentável a um desafio. O seed inicial disponibiliza dois desafios ambientais publicados: redução de descartáveis e separação de resíduos.

O fluxo de participação é idempotente. O usuário pode ingressar em um desafio publicado, registrar ações compatíveis com o tipo esperado e acompanhar o progresso. O progresso é limitado à meta configurada. A pontuação só é concedida na conclusão, dentro de uma transação que grava a ação e atualiza a participação. Depois da confirmação da transação, os pontos são somados ao progresso de gamificação.

Os métodos gRPC adicionados são `ListarDesafios`, `ParticiparDesafio` e `RegistrarAcaoSustentavel`. A listagem respeita paginação, exibe o progresso do usuário autenticado e não expõe campos internos do banco.

## Auditoria

A tabela `lcr_registros_auditoria` passou a ser utilizada pelo serviço de auditoria. Eventos possuem tipo, recurso, identificador de correlação, usuário, endereço IP e detalhes JSONB. O serviço remove valores de chaves sensíveis, como tokens, autorizações, senhas e segredos, antes de persistir os detalhes.

A consulta administrativa exige a permissão `auditoria:consultar`. Os métodos gRPC são `RegistrarEventoAuditoria` e `ListarAuditoria`.

## Rate limiting

Foi criado um rate limiter atômico com Redis e script Lua. A operação incrementa a contagem e configura a expiração somente no primeiro acesso da janela. O fluxo de participação é limitado a dez operações por usuário por minuto, enquanto o registro de ações é limitado a vinte operações por usuário por minuto. Se o Redis estiver indisponível, a mutação falha fechada para evitar que a proteção seja silenciosamente ignorada.

## Validação

| Verificação | Resultado |
|---|---|
| Buf lint dos novos contratos | Aprovado |
| TypeScript estrito | Aprovado |
| Testes unitários | 15 aprovados |
| Testes de integração | 4 aprovados |
| Migrations 019–021 | Aplicadas |
| Rollback das migrations 019–021 | Aprovado |
| Seeds repetidos | Idempotentes |
| Bootstrap gRPC | Aprovado |
| Compilação | Aprovada |

A integração confirmou que a conclusão de um desafio concede a pontuação configurada, persiste as ações, atualiza o progresso do usuário, registra auditoria e bloqueia a terceira operação acima do limite Redis configurado.
