# Etapa 4.10 — Saúde, configuração e observabilidade

A API passou a possuir health check real de PostgreSQL e Redis. A resposta informa o status agregado do serviço, a data da verificação, o estado independente de cada dependência e a versão da API. Em desenvolvimento, dependências não configuradas são explicitamente sinalizadas; em produção, a validação de ambiente impede a inicialização incompleta.

A validação de produção agora exige URL do banco, URL do Redis, emissor OIDC, audiência OIDC, endereço JWKS e segredo de hash dos participantes. URLs inválidas e segredos com menos de 32 caracteres são rejeitados antes da criação do microserviço.

A observabilidade recebeu redaction recursivo de tokens, senhas, segredos, autorizações, cookies e refresh tokens, além de truncamento de strings longas. Um interceptor registra duração, conclusão e falha de chamadas gRPC sem registrar payloads. O filtro global registra tipo, código e mensagem limitada dos erros, evitando vazamento de stack trace ou credenciais.

## Validação da etapa

| Verificação | Resultado |
|---|---|
| Health check sem dependências | Aprovado |
| Redaction recursivo | Aprovado |
| Validação de produção incompleta | Bloqueada corretamente |
| Bootstrap de produção configurado | Aprovado |
| Testes unitários | 24 aprovados |
| Testes de integração | 4 aprovados |
| Buf lint e geração | Aprovados |
| TypeScript e compilação | Aprovados |
| Bootstrap gRPC | Aprovado |

A etapa foi publicada separadamente no GitHub.
