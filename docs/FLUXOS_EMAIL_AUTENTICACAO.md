# Fluxos de e-mail da autenticação

Esta etapa implementa confirmação de e-mail e recuperação de senha com envio
transacional pelo Resend. O usuário recebe um **código de 6 caracteres** e o
digita no aplicativo — não há link de uso único. O acesso à aplicação só é
liberado depois que o e-mail é confirmado.

## Regra central: sem e-mail confirmado não há acesso

O cadastro cria a conta, mas **não abre sessão**. O login com credenciais
corretas de uma conta ainda não confirmada também não emite tokens. Nas duas
situações a API responde com `requer_verificacao_email = true`, tokens vazios e
a identidade do usuário, para que o frontend conduza o usuário à tela de
verificação.

```text
CadastrarUsuario / Entrar
        ↓
E-mail confirmado?  ── não ──→ requer_verificacao_email = true, sem tokens
        │                              ↓
       sim                    tela de verificação (código de 6 caracteres)
        ↓                              ↓
tokens de sessão emitidos      ConfirmarEmail → acesso liberado
```

O bloqueio é aplicado na API, não apenas no roteamento do frontend: enquanto
`lcr_usr_email_verificado_em` for nulo, nenhuma sessão é criada para a conta.

## RPCs do `ServicoAutenticacao`

| RPC | Entrada | Saída |
|---|---|---|
| `SolicitarVerificacaoEmail` | `email_usuario` | `solicitacao_aceita`, `expira_em_segundos`, `mensagem_resultado`, `comprimento_codigo` |
| `ConfirmarEmail` | `email_usuario`, `codigo_verificacao` | `email_confirmado`, `email_usuario`, `mensagem_resultado` |
| `SolicitarRecuperacaoSenha` | `email_usuario` | `solicitacao_aceita`, `expira_em_segundos`, `mensagem_resultado`, `comprimento_codigo` |
| `RedefinirSenha` | `email_usuario`, `codigo_redefinicao`, `nova_senha_usuario` | `senha_redefinida`, `sessoes_revogadas`, `mensagem_resultado` |

`CadastrarUsuarioResposta` e `EntrarResposta` receberam o campo
`requer_verificacao_email`. `IdentidadeAutenticada` e
`ObterIdentidadeAtualResposta` expõem `email_verificado_usuario`.

Os campos `token_verificacao` e `token_redefinicao` foram removidos do contrato
e estão reservados (`reserved 1` / `reserved 1, 2`), impedindo reutilização
acidental dos números de campo.

## Fluxo de confirmação de e-mail

```text
Cadastro (CadastrarUsuario)
        ↓
API cria conta e papel `usuario` — sem sessão
        ↓
Frontend chama SolicitarVerificacaoEmail
        ↓
API sorteia código de 6 caracteres → grava somente o HMAC-SHA256
        ↓
Resend envia HTML + texto com o código em destaque
        ↓
Usuário digita o código na tela de verificação
        ↓
ConfirmarEmail valida, consome o código e grava lcr_usr_email_verificado_em
        ↓
Login passa a emitir tokens de sessão
```

## Fluxo de recuperação de senha

```text
Esqueci a senha (SolicitarRecuperacaoSenha)
        ↓
Resposta neutra (não revela se o e-mail existe)
        ↓
Resend envia código de 6 caracteres (15 minutos)
        ↓
Usuário informa e-mail, código e nova senha
        ↓
RedefinirSenha: consome o código, grava hash scrypt e revoga todas as sessões
```

## O código de 6 caracteres

| Aspecto | Decisão |
|---|---|
| Alfabeto | `23456789BCDFGHJKMNPQRSTVWXYZ` — 28 caracteres, **sem vogais** e **sem `0`, `1`, `I`, `L`, `O`** |
| Espaço de busca | 28⁶ = 481.890.304 combinações |
| Geração | `randomInt` do módulo `node:crypto` (aleatoriedade criptográfica) |
| Persistência | HMAC-SHA256 com chave secreta, isolado por tipo de fluxo |
| Digitação | Aceita minúsculas, espaços e hífens; normalizado antes da comparação |
| Uso único | Consumido na validação; reuso é recusado |
| Expiração | 15 minutos |
| Tentativas | 5 erros invalidam o código |

O alfabeto não usa vogais para evitar a formação casual de palavras ofensivas,
e exclui caracteres ambíguos que o usuário confunde ao transcrever o código do
e-mail para o aplicativo.

### Por que HMAC e não SHA-256

Com 6 caracteres, um hash simples seria reversível por força bruta a partir do
banco: o atacante testaria as 481 milhões de combinações em segundos. O HMAC
com chave secreta torna o dump do banco inútil sem o segredo.

A chave vem de `SEGREDO_CODIGO_EMAIL`. Quando essa variável não existe, a API
deriva uma subchave de `SEGREDO_JWT` com separação de domínio, evitando
reutilizar o mesmo material de chave em duas finalidades distintas.

O tipo do fluxo entra na mensagem do HMAC: o mesmo código em
`verificacao_email` e `redefinicao_senha` produz hashes diferentes.

### Colisão

Dois códigos ativos iguais tornariam a confirmação ambígua. A geração sorteia
novamente quando o hash já está em uso, até 5 tentativas; esgotadas, a
solicitação falha com `UNAVAILABLE` e nada é gravado.

## Controles de segurança

| Controle | Implementação |
|---|---|
| Bloqueio de acesso | Nenhuma sessão é criada enquanto o e-mail não estiver confirmado |
| Armazenamento do código | Somente HMAC-SHA256 com chave secreta; o código original nunca é recuperável |
| Uso único | `lcr_tka_data_consumo` marcado no consumo; consumo exige registro pendente e não expirado |
| Expiração | 15 minutos para os dois fluxos |
| Limite de tentativas | 5 tentativas inválidas invalidam o código (`lcr_tka_quantidade_tentativas`) |
| Substituição de códigos | Cada nova solicitação consome os códigos pendentes do mesmo tipo |
| Rate limit | 3 solicitações por e-mail e 10 por origem a cada 15 minutos; 20 tentativas de código por origem |
| Enumeração de contas | Resposta neutra idêntica para e-mail existente e inexistente; a confirmação usa a mesma mensagem para código errado, expirado ou inexistente |
| Falha de envio | O código é invalidado se o provedor não confirmar o envio |
| Senha | Hash `scrypt` com salt aleatório; política mínima de 12 caracteres com letras e números |
| Sessões | Redefinição de senha revoga todas as sessões abertas do usuário |
| Auditoria | Eventos registrados com e-mail mascarado; códigos nunca são gravados |
| Log | O provedor `log` registra apenas destinatário mascarado, assunto e identificador |

## Configuração

| Variável | Uso |
|---|---|
| `PROVEDOR_EMAIL` | `resend` (padrão) ou `log` para desenvolvimento sem envio real |
| `RESEND_CHAVE_API` | Chave da API do Resend; usada somente pela API |
| `EMAIL_REMETENTE` | Endereço remetente verificado no Resend |
| `EMAIL_NOME_REMETENTE` | Nome exibido do remetente |
| `URL_PUBLICA_FRONTEND` | Base pública do frontend, usada em mensagens e validação de produção |
| `SEGREDO_CODIGO_EMAIL` | Chave do HMAC do código (mínimo 32 caracteres). Opcional: sem ela, deriva-se de `SEGREDO_JWT` |

Em produção, `PROVEDOR_EMAIL=log` é recusado e `RESEND_CHAVE_API`,
`EMAIL_REMETENTE` e `URL_PUBLICA_FRONTEND` passam a ser obrigatórias.

A chave do Resend nunca é enviada ao frontend: o navegador fala apenas com a
API gRPC, que executa o envio conforme a orientação oficial do Resend para
variáveis de ambiente.

## Migrações

| Migração | Efeito |
|---|---|
| `023_adicionar_lcr_email_verificado_usuario` | Adiciona `lcr_usr_email_verificado_em` em `lcr_usuarios` |
| `024_criar_lcr_tokens_autenticacao` | Cria a tabela de códigos de uso único com índice único de hash, índice por usuário/tipo e restrição de tipo |

## Testes

```bash
pnpm testar              # unidade: alfabeto, HMAC, fluxos, templates e rate limit
pnpm testar:integracao   # fluxo real sobre PostgreSQL: consumo único, tentativas, revogação e auditoria
node scripts/smoke_fluxos_email.mjs   # ponta a ponta contra a API gRPC compilada
```

O teste de integração substitui o provedor por um coletor em memória e valida
persistência, expiração, reuso recusado, limite de tentativas e troca de hash
sem enviar e-mail real. O smoke test sobe a API em porta isolada e cobre 37
verificações, incluindo o bloqueio de login antes da confirmação.

O envio real deve ser verificado manualmente com `PROVEDOR_EMAIL=resend` e uma
chave válida, enviando para um endereço controlado.

## Testar o código sem enviar e-mail

Com `PROVEDOR_EMAIL=log` nenhum e-mail sai e o log mostra apenas metadados —
por segurança, o código nunca aparece no log. Para testar as telas de
verificação e de redefinição no navegador, gere um código de desenvolvimento:

```bash
# confirmação de e-mail (expira em 15 minutos)
node scripts/gerar-codigo-desenvolvimento.mjs seu-email@exemplo.com

# redefinição de senha (expira em 15 minutos)
node scripts/gerar-codigo-desenvolvimento.mjs seu-email@exemplo.com redefinicao
```

O script grava um código real — mesmo alfabeto, mesmo HMAC, mesma expiração,
mesmo consumo único — e imprime o valor para digitar no aplicativo. A conta
precisa existir e estar com status `ativo`.

Ele recusa execução com `AMBIENTE_EXECUCAO=producao` e é o único ponto do
projeto que escreve um código fora do fluxo da aplicação; use apenas em
desenvolvimento.