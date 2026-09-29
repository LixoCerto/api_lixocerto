# Contas locais de homologação

Este seeder separado prepara contas para testar os papéis **usuário**, **pesquisador** e **revisor**. Ele não adiciona nem altera contas administrativas: exige que já exista pelo menos um administrador ativo. Os seeders de referência (`pnpm semear`) continuam sem criar contas de login.

O seeder cria ou atualiza somente estas identidades reservadas, usando o domínio não roteável `.test`:

| Papel | E-mail local | Senha fixa de desenvolvimento |
|---|---|---|
| Usuário | `homologacao.usuario@exemplo.test` | `LcrHml_Usr_7Qv2!2026` |
| Pesquisador | `homologacao.pesquisador@exemplo.test` | `LcrHml_Pesq_4Mx8!2026` |
| Revisor | `homologacao.revisor@exemplo.test` | `LcrHml_Rev_9Ka3!2026` |

As contas ficam ativas e com e-mail confirmado para uso local. O seeder grava somente hashes scrypt compatíveis com o login; não imprime as senhas durante a execução. **Essas credenciais estão versionadas no repositório privado por solicitação e são exclusivamente para desenvolvimento local. Qualquer pessoa com acesso ao repositório poderá vê-las: não as use em produção, não as reutilize em outros serviços e mantenha os repositórios privados.**

## Proteções e repetição

- Só executa quando `AMBIENTE_EXECUCAO=desenvolvimento` **e** `LCR_SEMEAR_CONTAS_HOMOLOGACAO=true`.
- Usa um caminho de seed separado; não faz parte de `pnpm semear` nem dos seeds normais.
- Verifica previamente os papéis e um administrador ativo. Se um e-mail reservado pertencer a outra identidade, falha em vez de sobrescrevê-la.
- É idempotente para as três identidades reservadas. Ao repetir, redefine a senha fixa, mantém exatamente um papel por conta e revoga sessões antigas dessas contas.
- O `down` **bloqueia** essas contas e revoga suas sessões, sem apagá-las nem tocar nas demais contas, preservando o histórico de testes.

## Atualizar e executar no Docker Desktop (PowerShell)

```powershell
Set-Location G:\LixoCerto

git -C .\api_lixocerto pull --ff-only origin main
git -C .\infra_lixocerto pull --ff-only origin main

Set-Location G:\LixoCerto\infra_lixocerto
docker compose -f compose.yml --profile app build --no-cache api

$env:LCR_SEMEAR_CONTAS_HOMOLOGACAO = 'true'
try {
  docker compose -f compose.yml --profile app run --rm --no-deps `
    -e LCR_SEMEAR_CONTAS_HOMOLOGACAO `
    api pnpm semear:homologacao
} finally {
  Remove-Item Env:LCR_SEMEAR_CONTAS_HOMOLOGACAO -ErrorAction SilentlyContinue
}
```

A execução precisa terminar com a mensagem de sucesso `Contas locais de homologação prontas`. Não execute esse seeder contra produção. Depois, entre com cada e-mail em uma sessão separada; mantenha as contas administrativas atuais para testar o nível administrador.
