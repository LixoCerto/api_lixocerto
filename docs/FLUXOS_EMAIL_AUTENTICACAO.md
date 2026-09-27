# Fluxos de e-mail da autenticação

Esta etapa implementa confirmação de e-mail e recuperação de senha com envio
transacional pelo Resend, tokens de uso único persistidos como hash e
revogação de sessões após a troca de senha.

## RPCs adicionados ao `ServicoAutenticacao`

| RPC | Entrada | Saída |
|---|---|---|
| `SolicitarVerificacaoEmail` | `email_usuario` | `solicitacao_aceita`, `expira_em_segundos`, `mensagem_resultado` |
| `ConfirmarEmail` | `token_verificacao` | `email_confirmado`, `email_usuario`, `mensagem_resultado` |
| `SolicitarRecuperacaoSenha` | `email_usuario` | `solicitacao_aceita`, `expira_em_segundos`, `mensagem_resultado` |
| `RedefinirSenha` | `token_redefinicao`, `nova_senha_usuario` | `senha_redefinida`, `sessoes_revogadas`, `mensagem_resultado` |

O campo `email_verificado_usuario` foi adicionado às mensagens
`IdentidadeAutenticada` e `ObterIdentidadeAtualResposta`, permitindo que o
frontend sinalize a pendência de confirmação sem expor detalhes internos.

## Fluxo completo

```text
Cadastro (CadastrarUsuario)
        ↓
API cria conta, papel `usuario` e sessão JWT
        ↓
Frontend solicita SolicitarVerificacaoEmail
        ↓
API gera token opaco (32 bytes) → grava somente SHA-256
        ↓
Resend envia HTML + texto com link de uso único
        ↓
Usuário abre /confirmar-email?token=...
        ↓
ConfirmarEmail valida, consome o token e grava lcr_usr_email_verificado_em
```

```text
Esqueci a senha (SolicitarRecuperacaoSenha)
        ↓
Resposta neutra (não revela se o e-mail existe)
        ↓
Resend envia link de redefinição (60 minutos)
        ↓
Usuário abre /redefinir-senha?token=...
        ↓
RedefinirSenha: consome token, grava hash scrypt e revoga todas as sessões
```

## Controles de segurança

| Controle | Implementação |
|---|---|
| Armazenamento do token | Somente hash SHA-256 em `lcr_tokens_autenticacao`; o valor original nunca é recuperável |
| Uso único | `lcr_tka_data_consumo` marcado no consumo; consumo exige token pendente e não expirado |
| Expiração | 24 horas para confirmação de e-mail; 60 minutos para redefinição de senha |
| Limite de tentativas | 5 tentativas inválidas invalidam o token (`lcr_tka_quantidade_tentativas`) |
| Substituição de links | Cada nova solicitação consome os tokens pendentes do mesmo tipo |
| Rate limit | 3 solicitações por e-mail e 10 por origem a cada 15 minutos; 20 tentativas de token por origem |
| Enumeração de contas | Resposta neutra idêntica para e-mail existente e inexistente |
| Falha de envio | Token é invalidado se o provedor não confirmar o envio |
| Senha | Hash `scrypt` com salt aleatório; política mínima de 12 caracteres com letras e números |
| Sessões | Redefinição de senha revoga todas as sessões abertas do usuário |
| Auditoria | Eventos registrados com e-mail mascarado; tokens e links nunca são gravados |
| Log | O provedor `log` registra apenas destinatário mascarado, assunto e identificador |

## Configuração

| Variável | Uso |
|---|---|
| `PROVEDOR_EMAIL` | `resend` (padrão) ou `log` para desenvolvimento sem envio real |
| `RESEND_CHAVE_API` | Chave da API do Resend; usada somente pela API |
| `EMAIL_REMETENTE` | Endereço remetente verificado no Resend |
| `EMAIL_NOME_REMETENTE` | Nome exibido do remetente |
| `URL_PUBLICA_FRONTEND` | Base dos links enviados por e-mail; deve ser `https` em produção |

Em produção, `PROVEDOR_EMAIL=log` é recusado e `RESEND_CHAVE_API`,
`EMAIL_REMETENTE` e `URL_PUBLICA_FRONTEND` passam a ser obrigatórias.

A chave nunca é enviada ao frontend: o navegador fala apenas com a API gRPC, que
executa o envio conforme a orientação oficial do Resend para variáveis de ambiente.

## Migrações

| Migração | Efeito |
|---|---|
| `023_adicionar_lcr_email_verificado_usuario` | Adiciona `lcr_usr_email_verificado_em` em `lcr_usuarios` |
| `024_criar_lcr_tokens_autenticacao` | Cria a tabela de tokens de uso único com índice único de hash, índice por usuário/tipo e restrição de tipo |

## Testes

```bash
pnpm testar              # unidade, incluindo templates, tokens e rate limit
pnpm testar:integracao   # fluxo real sobre PostgreSQL: consumo único, revogação e auditoria
```

O teste de integração substitui o provedor por um coletor em memória: valida
persistência, expiração, reuso recusado e troca de hash sem enviar e-mail real.
O envio real deve ser verificado manualmente com `PROVEDOR_EMAIL=resend` e uma
chave válida, enviando para um endereço controlado.

## Testar o link no navegador sem enviar e-mail

Com `PROVEDOR_EMAIL=log` nenhum e-mail sai e o log mostra apenas metadados —
por segurança, o token nunca aparece no log. Para testar as telas
`/confirmar-email` e `/redefinir-senha` no navegador, gere um link de
desenvolvimento:

```bash
# confirmação de e-mail (expira em 24 horas)
node scripts/gerar-link-desenvolvimento.mjs seu-email@exemplo.com

# redefinição de senha (expira em 60 minutos)
node scripts/gerar-link-desenvolvimento.mjs seu-email@exemplo.com redefinicao
```

O script grava um token de uso único exatamente como a API faria — mesmo hash
SHA-256, mesma expiração, mesmo consumo único — e imprime a URL pronta para
abrir. A conta precisa existir e estar com status `ativo`.

Ele recusa execução com `AMBIENTE_EXECUCAO=producao` e é o único ponto do
projeto que escreve um token fora do fluxo da aplicação; use apenas em
desenvolvimento.
