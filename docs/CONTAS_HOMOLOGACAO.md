# Contas locais de homologação

Este seeder separado prepara contas para testar os papéis **usuário**, **pesquisador** e **revisor**. Ele não adiciona nem altera contas administrativas: exige que já exista pelo menos um administrador ativo. Os seeders de referência (`pnpm semear`) continuam sem criar contas de login.

O seeder cria ou atualiza somente estas identidades reservadas, usando o domínio não roteável `.test`:

| Papel | E-mail local |
|---|---|
| Usuário | `homologacao.usuario@exemplo.test` |
| Pesquisador | `homologacao.pesquisador@exemplo.test` |
| Revisor | `homologacao.revisor@exemplo.test` |

As contas ficam ativas e com e-mail confirmado para uso no ambiente local. As senhas são fornecidas em variáveis de ambiente, recebem hash scrypt compatível com o login e **não são versionadas nem impressas**. Configure senhas distintas de pelo menos 12 caracteres, com letras e números.

## Proteções e repetição

- Só executa quando `AMBIENTE_EXECUCAO=desenvolvimento` **e** `LCR_SEMEAR_CONTAS_HOMOLOGACAO=true`.
- Usa um caminho de seed separado; não faz parte de `pnpm semear` nem dos seeds normais.
- Verifica previamente os papéis e um administrador ativo. Se um e-mail reservado pertencer a outra identidade, falha em vez de sobrescrevê-la.
- É idempotente para as três identidades reservadas. Ao repetir, redefinirá suas senhas para os valores informados, manterá exatamente um papel por conta e revogará sessões antigas dessas contas.
- O `down` **bloqueia** essas contas e revoga suas sessões, sem apagá-las nem tocar nas demais contas, preservando o histórico de testes.

## Executar no Docker Desktop (PowerShell)

Atualize a API antes, mantendo alterações locais em `.env` e `.env.exemplo`:

```powershell
Set-Location G:\LixoCerto

git -C .\api_lixocerto pull --ff-only origin main
```

Defina o opt-in e forneça três senhas distintas de modo que a digitação não apareça no terminal:

```powershell
function Set-SecureEnvironmentVariable {
  param([string]$Name, [string]$Prompt)
  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    Set-Item -Path "Env:$Name" -Value $plain
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

$env:LCR_SEMEAR_CONTAS_HOMOLOGACAO = 'true'
Set-SecureEnvironmentVariable 'LCR_SENHA_HOMOLOGACAO_USUARIO' 'Senha da conta usuário'
Set-SecureEnvironmentVariable 'LCR_SENHA_HOMOLOGACAO_PESQUISADOR' 'Senha da conta pesquisador'
Set-SecureEnvironmentVariable 'LCR_SENHA_HOMOLOGACAO_REVISOR' 'Senha da conta revisor'

Set-Location G:\LixoCerto\infra_lixocerto
try {
  docker compose -f compose.yml --profile app run --rm --no-deps `
    -e LCR_SEMEAR_CONTAS_HOMOLOGACAO `
    -e LCR_SENHA_HOMOLOGACAO_USUARIO `
    -e LCR_SENHA_HOMOLOGACAO_PESQUISADOR `
    -e LCR_SENHA_HOMOLOGACAO_REVISOR `
    api pnpm semear:homologacao
} finally {
  @(
    'LCR_SEMEAR_CONTAS_HOMOLOGACAO',
    'LCR_SENHA_HOMOLOGACAO_USUARIO',
    'LCR_SENHA_HOMOLOGACAO_PESQUISADOR',
    'LCR_SENHA_HOMOLOGACAO_REVISOR'
  ) | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
}
```

Não execute esse seeder contra produção. Em seguida, entre com a conta administrativa já existente e teste cada e-mail em uma sessão separada. As contas e senhas devem ficar restritas ao ambiente local; não as reutilize em outros serviços.
