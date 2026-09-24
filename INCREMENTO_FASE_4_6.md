# Etapa 4.8 — Administração, papéis e permissões

A etapa completou o primeiro conjunto restante da Fase 4. O módulo administrativo agora consulta um resumo agregado do PostgreSQL, contendo usuários ativos, materiais publicados, pontos de coleta pendentes e avaliações com consentimento. O acesso ao resumo exige a permissão `administracao:consultar`.

Os módulos de papéis e permissões deixaram de ser placeholders. Ambos possuem serviços de consulta dos registros ativos, ordenados por nome ou código, e são utilizados pela camada administrativa e pelos testes de autorização. O seed idempotente passou a incluir a permissão administrativa, totalizando onze permissões e vinte e quatro relações com os quatro papéis padrão.

## Validação da etapa

| Verificação | Resultado |
|---|---|
| Seed idempotente com nova permissão | Aprovado |
| Resumo administrativo em PostgreSQL | Aprovado |
| Catálogo de papéis | 4 registros ativos |
| Catálogo de permissões | 11 registros ativos |
| Testes unitários | 17 aprovados |
| Testes de integração | 4 aprovados |
| Buf lint | Aprovado |
| TypeScript e compilação | Aprovados |
| Bootstrap gRPC | Aprovado |

A etapa foi publicada separadamente no GitHub conforme o plano de encerramento da Fase 4.
