# Operação local, privacidade e backup — LixoCerto

**Escopo:** ambiente acadêmico/local com Docker Compose. Este guia descreve o estado do repositório e práticas recomendadas; não é certificação de conformidade legal nem substitui a política de privacidade aprovada pela instituição.

## Estado atual da infraestrutura

- O `compose.yml` inicia API, frontend, Envoy e Redis. **Não existe serviço PostgreSQL nesse Compose**: a conexão da API vem da configuração local em `api_lixocerto/.env`.
- O volume nomeado `lcr-redis-data` é do Redis e **não é backup do banco PostgreSQL**.
- Não há rotina automática de backup/restauração PostgreSQL nem política de retenção versionada no projeto.
- A API registra método gRPC, duração e correlação; evite incluir payloads, tokens, coordenadas ou dados pessoais em logs.

## Localização e dados de pontos

- O navegador só solicita geolocalização após ação explícita da pessoa. As coordenadas são enviadas para filtrar pontos próximos; o fluxo de busca não as grava como perfil/localização persistente.
- Ao cadastrar ou atualizar um ponto, latitude/longitude e endereço do ponto são dados do próprio local de coleta, não da localização corrente da pessoa. A reverse geocodificação usa OpenStreetMap/Nominatim e deve manter atribuição visível e respeito à política do serviço.
- Horário, telefone e URL informativa são opcionais. Publique apenas informações públicas confirmadas, use HTTPS quando disponível e revalide-as; não cadastre telefone ou endereço pessoal de colaboradores.
- `data_verificacao` é gerada pela API quando o ponto é marcado como verificado; correção posterior pode exigir nova revisão.

## Dados de conta e minimização

O fluxo atual mantém contas e sessões, incluindo endereço IP e agente do navegador na sessão. O cadastro exige confirmação de e-mail antes de abrir sessão. Os seeders de homologação usam contas `.test` e são restritos a desenvolvimento.

O fluxo de gamificação acrescenta atribuições e respostas de quiz, eventos de pontuação, selos e relatos de descarte ligados ao identificador interno da conta. O fluxo novo de descarte grava latitude/longitude e precisão do GPS durante o check-in, além de metadados de fotos por categoria; cada relato contém ponto, categoria, data, estado e texto opcional limitado a 500 caracteres. A API exige até 5 m do ponto e precisão reportada de até 10 m. A equipe revisa manualmente a compatibilidade ponto/categoria e a evidência, portanto a aprovação **não deve ser descrita como comprovação automática da entrega física**. Oriente participantes a não inserir nomes, contatos ou outros dados pessoais no relato nem fotografar pessoas, documentos ou placas. A pontuação só é liberada após a aprovação e os endpoints restringem a consulta à própria pessoa ou à equipe revisora autorizada.

## Check-in, fotos e retenção de evidências

- O check-in só é iniciado por ação da pessoa, num ponto verificado com coordenadas válidas; o servidor calcula novamente a distância geodésica e exige raio estrito de 5 m. A precisão declarada pelo navegador precisa ser de até 10 m. Um check-in expira em 30 minutos.
- Cada categoria aceita selecionada gera um registro pendente e exige sua própria foto. O servidor aceita JPEG, PNG ou WebP estáticos (até 2 MiB por arquivo), valida o conteúdo real, corrige a orientação, redimensiona/comprime para WebP e calcula SHA-256/tamanho. A recodificação remove metadados EXIF. Em Docker, os objetos ficam fora do banco e do Git, no bucket privado `lcr-evidencias-descartes` do serviço MinIO local, persistido no volume `lcr-minio-data`; a API usa uma chave S3 de menor privilégio e não publica caminhos nem URLs permanentes. A referência Docker é `minio/minio:latest`, conforme escolhida pelo responsável, e o bootstrap usa `minio/mc:latest` para preparar o bucket e a identidade da aplicação.
- Só a pessoa proprietária ou um revisor autorizado consegue consultar a foto, por RPC autenticado; as coordenadas exatas não são retornadas no histórico nem registradas na auditoria. Aprovação exige check-in e foto ainda disponíveis, ponto verificado e categoria aceita.
- Um envio pendente conserva foto e dados do check-in até a decisão. Após aprovação/rejeição, as fotos expiram 90 dias depois da decisão, e as coordenadas do check-in são removidas 90 dias após a última decisão dos registros daquele check-in. Check-ins abandonados sem registros expiram em 30 minutos e são removidos na rotina de expurgo (executada na inicialização e a cada 10 minutos). Até o expurgo, endpoints deixam de servir fotos assim que a validade termina.
- A expiração da foto não remove o registro de auditoria, a categoria, o estado, os pontos já concedidos nem outros campos do descarte. Se não houver revisão, a retenção permanece pendente; defina responsáveis e prazo operacional de revisão antes de convidar participantes reais.

Antes de coleta acadêmica real, atualize aviso e consentimento aprovado pela instituição para explicar check-in, precisão/uso da localização, fotos, revisão humana, armazenamento local e prazos acima. Avalie a necessidade de proteção adicional/criptografia do volume e restrinja o acesso à máquina que hospeda o Docker.

Antes de coletar dados de participantes, atualize o aviso de privacidade e o consentimento aprovado pela instituição para explicar esse histórico de participação/pontuação e sua retenção. O ledger registra a origem e a categoria da recompensa para idempotência e auditoria; o ranking público usa rótulos genéricos em vez de nome ou e-mail.

Antes de uma coleta acadêmica real, defina e aprove com a instituição: finalidade, aviso/consentimento, dados estritamente necessários, responsáveis, retenção, canal de solicitação/remoção e tratamento de incidentes. Não use contas reais de participantes no ambiente de desenvolvimento. O expurgo automático descrito acima cobre fotos e coordenadas de check-in; não apaga eventos de pontuação, respostas, registros de descarte ou o histórico de auditoria, e não há fluxo completo de autoatendimento para exportação/exclusão desses registros — não prometa essa funcionalidade.

## Backup PostgreSQL manual (PowerShell)

Faça backup antes de migrations e em intervalos definidos pelo responsável pelo banco. Instale o cliente PostgreSQL (`pg_dump` e `pg_restore`) em uma máquina autorizada a alcançar o banco. Informe host, porta, base e usuário conforme a configuração local **sem imprimir nem compartilhar `.env`**. O script abaixo pede a senha sem ecoá-la; ela não fica no histórico do PowerShell nem na linha de comando. O arquivo é criado em `%USERPROFILE%\LixoCertoBackups`, fora dos clones Git.

```powershell
$ErrorActionPreference = 'Stop'
$diretorio = Join-Path $env:USERPROFILE 'LixoCertoBackups'
New-Item -ItemType Directory -Force -Path $diretorio | Out-Null
$arquivo = Join-Path $diretorio ("lixocerto-{0:yyyyMMdd-HHmmss}.dump" -f (Get-Date))

$env:PGHOST = Read-Host 'Host do PostgreSQL configurado para este ambiente'
$env:PGPORT = Read-Host 'Porta do PostgreSQL'
$env:PGDATABASE = Read-Host 'Nome da base de desenvolvimento'
$env:PGUSER = Read-Host 'Usuário de backup'
$senhaSegura = Read-Host 'Senha do PostgreSQL' -AsSecureString
$ponteiro = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($senhaSegura)
try {
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ponteiro)
  & pg_dump --format=custom --no-owner --no-acl --file $arquivo
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump falhou; não use o arquivo como backup válido.' }
  & pg_restore --list $arquivo | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'O arquivo não passou pela verificação pg_restore --list.' }
  Get-Item $arquivo | Select-Object FullName, Length, LastWriteTime
} finally {
  Remove-Item Env:PGPASSWORD, Env:PGHOST, Env:PGPORT, Env:PGDATABASE, Env:PGUSER -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ponteiro)
  $senhaSegura.Dispose()
}
```

O arquivo custom-format deve ficar fora do Git, em armazenamento com acesso restrito e criptografia em repouso. Ver `pg_restore --list` confirma que o arquivo é legível, mas **não** substitui um ensaio de restauração.

## Ensaio de recuperação

Restaure somente em uma base descartável/vazia, nunca sobre a base original. Use uma segunda base de teste e o usuário autorizado pelo responsável:

```powershell
# Depois de configurar, de forma privada, PGHOST, PGPORT, PGDATABASE (destino), PGUSER e PGPASSWORD:
pg_restore --exit-on-error --no-owner --no-acl --dbname $env:PGDATABASE $arquivo
if ($LASTEXITCODE -ne 0) { throw 'Restauração de teste falhou.' }
```

Valide migrations, contagens agregadas e login de homologação no destino descartável. Registre data, artefato, operador e resultado sem incluir credenciais. Só então marque o backup como ensaiado. Não execute `dropdb`, não sobrescreva produção e não guarde dumps em pastas sincronizadas públicas.

## Retenção recomendada para homologação

Enquanto a aplicação estiver em desenvolvimento, o responsável pode começar com backup antes de cada migration e um backup semanal durante a fase ativa; manter cópias rotacionadas (por exemplo, até quatro semanas) é uma **proposta operacional**, não um job configurado. Ajuste o período às regras acadêmicas e institucionais, remova dumps vencidos de forma segura e teste restauração antes de depender do backup.


## Backup pareado de PostgreSQL e evidências (PowerShell)

O banco guarda apenas chaves e metadados; após a migração, as imagens ficam no bucket privado `lcr-evidencias-descartes`, persistido no volume Docker `lcr-minio-data`. Para obter artefatos do mesmo estado, o script abaixo interrompe temporariamente API e MinIO, faz `pg_dump` e arquiva o volume na mesma janela. Ele preserva o estado anterior dos dois serviços e só os inicia ao final se estavam ativos. Os dois artefatos ficam em `%USERPROFILE%\LixoCertoBackups`, fora do Git; armazene-os juntos com acesso restrito e criptografia em repouso. O volume legado `lcr-descartes-evidencias` não é o destino ativo após a migração e permanece preservado separadamente até validação operacional.

```powershell
$ErrorActionPreference = 'Stop'
Set-Location G:\LixoCerto\infra_lixocerto
$diretorio = Join-Path $env:USERPROFILE 'LixoCertoBackups'
New-Item -ItemType Directory -Force -Path $diretorio | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$arquivoBanco = Join-Path $diretorio "lixocerto-$timestamp.dump"
$nomeArquivoMinio = "lcr-minio-data-$timestamp.tar.gz"
$arquivoMinio = Join-Path $diretorio $nomeArquivoMinio
$bind = "type=bind,source=$($diretorio.Replace('\', '/')),target=/backup"

$env:PGHOST = Read-Host 'Host PostgreSQL deste ambiente'
$env:PGPORT = Read-Host 'Porta PostgreSQL'
$env:PGDATABASE = Read-Host 'Nome da base de desenvolvimento'
$env:PGUSER = Read-Host 'Usuário de backup'
$senhaSegura = Read-Host 'Senha PostgreSQL' -AsSecureString
$ponteiro = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($senhaSegura)
$apiEstavaAtiva = [bool](docker compose -f compose.yml --profile app ps -q --status running api)
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível consultar o estado da API.' }
$minioEstavaAtivo = [bool](docker compose -f compose.yml --profile app ps -q --status running minio)
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível consultar o estado do MinIO.' }

try {
  docker image inspect alpine:3.20 *> $null
  if ($LASTEXITCODE -ne 0) {
    docker pull alpine:3.20
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível obter a imagem utilitária Alpine.' }
  }
  docker compose -f compose.yml --profile app stop api minio
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível parar API e MinIO para o snapshot.' }

  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ponteiro)
  & pg_dump --format=custom --no-owner --no-acl --file $arquivoBanco
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump falhou; não use o arquivo como backup válido.' }
  & pg_restore --list $arquivoBanco | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'O dump PostgreSQL falhou na verificação pg_restore --list.' }

  docker run --rm `
    --mount 'type=volume,source=lcr-minio-data,target=/origem,readonly' `
    --mount $bind `
    alpine:3.20 sh -c "tar -czf /backup/$nomeArquivoMinio -C /origem ."
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao arquivar o volume de dados do MinIO.' }
  docker run --rm --mount $bind alpine:3.20 tar -tzf "/backup/$nomeArquivoMinio" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'O arquivo MinIO falhou na verificação tar -tzf.' }

  Get-Item $arquivoBanco, $arquivoMinio | Select-Object FullName, Length, LastWriteTime
} finally {
  Remove-Item Env:PGPASSWORD, Env:PGHOST, Env:PGPORT, Env:PGDATABASE, Env:PGUSER -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ponteiro)
  $senhaSegura.Dispose()
  if ($minioEstavaAtivo) {
    docker compose -f compose.yml --profile app start minio
    if ($LASTEXITCODE -ne 0) { Write-Warning 'O MinIO não reiniciou automaticamente; verifique docker compose ps.' }
  }
  if ($apiEstavaAtiva) {
    docker compose -f compose.yml --profile app start api
    if ($LASTEXITCODE -ne 0) { Write-Warning 'A API não reiniciou automaticamente; verifique docker compose ps.' }
  }
}
```

### Ensaio de restauração do volume, sem sobrescrever o original

Restaure primeiro para um volume de teste isolado. O nome abaixo é único para não misturar arquivos de um ensaio anterior; o Compose continua usando o volume original:

```powershell
$ErrorActionPreference = 'Stop'
$diretorio = Join-Path $env:USERPROFILE 'LixoCertoBackups'
$nomeArquivoMinio = 'NOME-DO-ARQUIVO.tar.gz' # use o arquivo MinIO validado do backup
$volumeEnsaio = "lcr-minio-data-restore-test-$([guid]::NewGuid().ToString('N').Substring(0,8))"
$bind = "type=bind,source=$($diretorio.Replace('\', '/')),target=/backup"
Write-Host "Volume isolado deste ensaio: $volumeEnsaio"
docker volume create $volumeEnsaio | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar o volume de ensaio.' }
docker run --rm `
  --mount "type=volume,source=$volumeEnsaio,target=/destino" `
  --mount $bind `
  alpine:3.20 sh -c "tar -xzf /backup/$nomeArquivoMinio -C /destino"
if ($LASTEXITCODE -ne 0) { throw 'Restauração de ensaio do volume falhou.' }
docker run --rm --mount "type=volume,source=$volumeEnsaio,target=/dados,readonly" alpine:3.20 sh -c 'find /dados -type f | wc -l'
```

Compare a quantidade de arquivos e valide a inicialização em uma instância MinIO de ensaio e sua associação com uma cópia de teste do banco. Só remova o volume de ensaio após conferir o nome e o conteúdo; não use `docker volume prune`.
