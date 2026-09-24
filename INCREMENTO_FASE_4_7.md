# Etapa 4.9 — Identidade, perfil e sessões

A etapa completou os módulos de identidade, perfil e sessões da API. A identidade interna agora consulta o usuário persistido, verifica o status de acesso e expõe apenas dados necessários ao próprio usuário autenticado.

O perfil possui leitura e atualização do nome. O e-mail, o status, os papéis e as permissões não podem ser alterados pelo fluxo de perfil. O nome é normalizado, limitado ao tamanho da coluna e rejeita caracteres de controle.

O gerenciamento de sessões persiste somente hashes SHA-256 dos tokens e não retorna tokens ao cliente. É possível registrar uma sessão internamente, listar as sessões ativas do próprio usuário, revogar uma sessão específica e revogar todas as sessões. A revogação exige simultaneamente o identificador da sessão e o identificador do usuário autenticado, impedindo revogação cruzada entre contas.

Foram adicionados os contratos gRPC `ServicoIdentidade`, `ServicoPerfil` e `ServicoSessoes`. Os métodos de sessões não transportam tokens, apenas metadados e identificadores de sessão.

## Validação da etapa

| Verificação | Resultado |
|---|---|
| Contratos Protobuf de identidade, perfil e sessões | Aprovados |
| Atualização de perfil no PostgreSQL | Aprovada |
| Hash dos tokens de sessão | Implementado |
| Revogação individual | Aprovada |
| Revogação de todas as sessões | Implementada |
| Testes unitários | 19 aprovados |
| Testes de integração | 4 aprovados |
| TypeScript e compilação | Aprovados |
| Bootstrap gRPC | Aprovado |

A etapa foi publicada em commit independente no GitHub.
