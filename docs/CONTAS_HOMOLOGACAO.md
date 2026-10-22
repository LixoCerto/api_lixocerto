# Contas locais de homologação

Este seeder separado prepara contas para testar os papéis **usuário**, **pesquisador** e **revisor**. Ele não adiciona nem altera contas administrativas: exige que já exista pelo menos um administrador ativo. Os seeders de referência (`pnpm semear`) continuam sem criar contas de login.

O seeder cria ou atualiza somente estas identidades reservadas, usando o domínio não roteável `.test`:

| Papel | E-mail local | Senha |
|---|---|---|
| Usuário | `homologacao.usuario@exemplo.test` | `LCR_HOMOLOGACAO_SENHA_USUARIO` |
| Pesquisador | `homologacao.pesquisador@exemplo.test` | `LCR_HOMOLOGACAO_SENHA_PESQUISADOR` |
| Revisor | `homologacao.revisor@exemplo.test` | `LCR_HOMOLOGACAO_SENHA_REVISOR` |

As contas ficam ativas e com e-mail confirmado para uso local. O seeder recebe as senhas somente pelas variáveis do ambiente, grava apenas hashes scrypt compatíveis com o login e não imprime as senhas durante a execução.

## Matriz dos perfis-base

| Perfil | Capacidades principais | Áreas exibidas |
|---|---|---|
| `usuario` | Ler guia e pontos; responder quiz; ler gamificação e **participar** de desafios; enviar avaliação de usabilidade | Visão geral, Guia, Pontos, Quiz, Desafios, Pesquisa de usabilidade e Perfil |
| `pesquisador` | Ler guia e pontos; ler seu progresso; consultar **somente agregados** da avaliação de usabilidade | Visão geral, Guia, Pontos, Pesquisa de usabilidade e Perfil; sem quiz, participação em desafios, gestão ou auditoria |
| `revisor` | Ler/escrever/aprovar materiais e pontos; responder/administrar questionários; ler e administrar desafios | Visão geral, Guia, Pontos, Quiz, Desafios (gestão), Central de revisão e Perfil |
| `administrador` | Catálogo completo de permissões, incluindo resumo/administração, gestão de acessos e auditoria | Todas as áreas. A matriz do papel `administrador` continua protegida no backend. |

`gamificacao:participar` foi separado de `gamificacao:ler`: pesquisador não recebe ações de participação, e o servidor exige ambos para entrar/registrar ações em um desafio. Para atualizar bancos já semeados, execute novamente **somente para frente** o seed idempotente `001_inserir_papeis_permissoes.cjs`; isso adiciona a permissão nova e a associa aos papéis previstos. Não execute o `down` do seed.

## Proteções e repetição

- Só executa quando `AMBIENTE_EXECUCAO=desenvolvimento` **e** `LCR_SEMEAR_CONTAS_HOMOLOGACAO=true`.
- Usa um caminho de seed separado; não faz parte de `pnpm semear` nem dos seeds normais.
- Verifica previamente os papéis e um administrador ativo. Se um e-mail reservado pertencer a outra identidade, falha em vez de sobrescrevê-la.
- É idempotente para as três identidades reservadas. Ao repetir, redefine as senhas fornecidas no ambiente, mantém exatamente um papel por conta e revoga sessões antigas dessas contas.
- O `down` **bloqueia** essas contas e revoga suas sessões, sem apagá-las nem tocar nas demais contas, preservando o histórico de testes.

## Atualizar e executar no Docker Desktop (PowerShell)

```powershell
Set-Location G:\LixoCerto

git -C .\api_lixocerto pull --ff-only origin main
git -C .\frontend_lixocerto pull --ff-only origin main
git -C .\infra_lixocerto pull --ff-only origin main

Set-Location G:\LixoCerto\infra_lixocerto
docker compose -f compose.yml --profile app build --no-cache api frontend

# Antes de migrations, crie e valide um backup PostgreSQL fora dos clones Git;
# consulte G:\LixoCerto\api_lixocerto\docs\OPERACAO_PRIVACIDADE_E_BACKUP.md.
docker compose -f compose.yml --profile app run --rm --no-deps --entrypoint node api `
  node_modules/sequelize-cli/lib/sequelize db:migrate:status `
  --config configuracao_sequelize.cjs `
  --migrations-path banco/migracoes

# Aplica somente migrations pendentes, incluindo a 032 (campos opcionais dos pontos).
docker compose -f compose.yml --profile app run --rm --no-deps --entrypoint node api `
  node_modules/sequelize-cli/lib/sequelize db:migrate `
  --config configuracao_sequelize.cjs `
  --migrations-path banco/migracoes

# Preenche apenas códigos de catálogo que ainda não existem. É seguro repetir;
# NÃO execute db:seed:undo, pois o down remove registros do catálogo.
docker compose -f compose.yml --profile app run --rm --no-deps `
  --entrypoint node `
  api node_modules/sequelize-cli/lib/sequelize db:seed `
    --seed 003_inserir_catalogo_materiais_base.cjs `
    --config configuracao_sequelize.cjs `
    --seeders-path banco/dados_iniciais

# Reaplica a matriz RBAC de modo idempotente (não apaga dados).
docker compose -f compose.yml --profile app run --rm --no-deps `
  --entrypoint node `
  api node_modules/sequelize-cli/lib/sequelize db:seed `
    --seed 001_inserir_papeis_permissoes.cjs `
    --config configuracao_sequelize.cjs `
    --seeders-path banco/dados_iniciais

# Prepara cinco materiais curados como rascunhos; não publica.
$env:LCR_PREPARAR_LEVA_GUIA_INICIAL = 'true'
try {
  docker compose -f compose.yml --profile app run --rm --no-deps `
    -e LCR_PREPARAR_LEVA_GUIA_INICIAL `
    --entrypoint node `
    api node_modules/sequelize-cli/lib/sequelize db:seed `
      --seed 002_preparar_leva_inicial_guia.cjs `
      --config configuracao_sequelize.cjs `
      --seeders-path banco/seeds_homologacao
} finally {
  Remove-Item Env:LCR_PREPARAR_LEVA_GUIA_INICIAL -ErrorAction SilentlyContinue
}

# Cria/atualiza somente as três contas reservadas para homologação local.
$env:LCR_SEMEAR_CONTAS_HOMOLOGACAO = 'true'
try {
  docker compose -f compose.yml --profile app run --rm --no-deps `
    -e LCR_SEMEAR_CONTAS_HOMOLOGACAO `
    --entrypoint node `
    api node_modules/sequelize-cli/lib/sequelize db:seed:all `
      --config configuracao_sequelize.cjs `
      --seeders-path banco/seeds_homologacao
} finally {
  Remove-Item Env:LCR_SEMEAR_CONTAS_HOMOLOGACAO -ErrorAction SilentlyContinue
}

# Recria somente os serviços de aplicação após concluir migrations e seeds.
docker compose -f compose.yml --profile app up -d --no-deps --force-recreate api frontend
Start-Sleep -Seconds 20
docker compose -f compose.yml --profile app ps
curl.exe -I http://localhost:3000/
```

A preparação do Guia deve terminar com a mensagem de cinco rascunhos preparados, e a execução de contas com `Contas locais de homologação prontas`. Não execute esses comandos contra produção nem apague volumes. Depois de aplicar a matriz e criar as contas, encerre as sessões antigas e entre novamente com cada e-mail em uma sessão separada para receber permissões atualizadas; mantenha as contas administrativas atuais para testar o nível administrador. Os cinco materiais continuam rascunhos até revisão e publicação individual por revisor/administrador na Central de revisão.
