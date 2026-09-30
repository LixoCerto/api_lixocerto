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

Antes de uma coleta acadêmica real, defina e aprove com a instituição: finalidade, aviso/consentimento, dados estritamente necessários, responsáveis, retenção, canal de solicitação/remoção e tratamento de incidentes. Não use contas reais de participantes no ambiente de desenvolvimento. Não há, neste repositório, prazo automático documentado para expurgo desses registros nem fluxo completo de autoatendimento para exportação/exclusão; não prometa essas funcionalidades.

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
