# Postman nativo — Lixo Certo API gRPC

A API Lixo Certo expõe **26 métodos gRPC em 13 serviços** no pacote `lixo_certo.v1`. Ela não possui rotas REST equivalentes. Para que o Postman mostre **Invoke**, e não `POST`/`Send`, cada item precisa ser criado pelo cliente gRPC nativo do Postman e salvo em uma coleção a partir de **New > gRPC**.

## Arquivos entregues

- `Lixo-Certo-API.postman_environment.json`: ambiente local sem tokens reais.
- `Lixo-Certo-API.postman.proto`: definição raiz que agrega os contratos Protobuf.
- `Lixo-Certo-API.grpc.manifest.json`: catálogo dos 26 métodos, mensagens e metadados.
- `legado/Lixo-Certo-API.legado-http.postman_collection.json`: referência histórica não executável como gRPC nativo.

O manifesto é deliberadamente marcado como `importavelComoCollectionJson: false`. Ele não deve ser importado como coleção.

## Preparação no Windows

A partir de `G:\LixoCerto\infra_lixocerto`, execute:

```powershell
.\scripts\iniciar.ps1 -Aplicacao -PrepararPostman -SmokeTests
```

O comando sobe o ambiente local, copia os contratos, o ambiente e o catálogo para `%USERPROFILE%\Postman\files\lixo-certo`, e não copia a coleção HTTP legada.

## Criação da coleção nativa

1. Selecione o ambiente `Lixo Certo — API local — gRPC`.
   Confirme no seletor de ambiente no canto superior direito que ele aparece como **ativo**; se aparecer `No environment`, `{{nome_usuario}}` e os demais placeholders serão enviados vazios.
2. Abra **New > gRPC**.
3. Informe `grpc://{{grpc_host}}`, que resolve para `grpc://127.0.0.1:50051`.
4. Use server reflection ou importe `Lixo-Certo-API.postman.proto` na aba **Service definition**.
5. Selecione o serviço e o método.
6. Preencha a mensagem conforme o manifesto.
7. Clique em **Save As** e salve na coleção `Lixo Certo — API gRPC — Nativa`.

Repita para os 26 métodos. Nenhum item deve ser HTTP `POST`, possuir URL HTTP ou usar `Content-Type: application/grpc+json`.

Para o cadastro, não deixe os campos vazios. O Postman pode exibir os nomes protobuf como `nome_usuario`/`email_usuario`/`senha_usuario` ou como `nomeUsuario`/`emailUsuario`/`senhaUsuario`; ambos são aceitos pela API. Uma mensagem mínima válida é:

```json
{
  "nome_usuario": "Usuario Postman",
  "email_usuario": "usuario-novo@exemplo.test",
  "senha_usuario": "SenhaPostman123"
}
```

Se o editor mostrar `{{nome_usuario}}`, verifique que o ambiente está ativo e que a variável possui valor. O valor de `senha_usuario` permanece vazio no arquivo versionado por segurança e precisa ser preenchido somente no ambiente local.

## Fluxo de autenticação local

A API agora gera seus próprios tokens. Não é necessário Keycloak, OIDC ou login externo.

### 1. Cadastro ou login

Crie uma requisição gRPC para `ServicoAutenticacao/CadastrarUsuario` ou `ServicoAutenticacao/Entrar`.

Exemplo de cadastro:

```json
{
  "nome_usuario": "Usuario Postman",
  "email_usuario": "usuario@exemplo.test",
  "senha_usuario": "SenhaSegura123"
}
```

Exemplo de login:

```json
{
  "email_usuario": "usuario@exemplo.test",
  "senha_usuario": "SenhaSegura123"
}
```

Copie os valores retornados para as variáveis locais `jwt_token` e `token_atualizacao`. Não versionar esses valores.

### 2. Chamadas protegidas

Na aba **Metadata**, use:

```text
authorization: Bearer {{jwt_token}}
```

### 3. Renovação

Use `ServicoAutenticacao/RenovarToken` com:

```json
{
  "token_atualizacao": "{{token_atualizacao}}"
}
```

Substitua as duas variáveis pelos novos tokens retornados.

### 4. Logout

Use `ServicoAutenticacao/Sair` com o token de atualização atual:

```json
{
  "token_atualizacao": "{{token_atualizacao}}"
}
```

## Endpoint correto

Use `grpc://127.0.0.1:50051` no cliente gRPC nativo do Postman. A porta `8080` é o gateway Envoy gRPC-Web utilizado pelo frontend e não substitui a API gRPC nativa.

## Validação automatizada

O Postman é usado para inspeção visual e chamadas interativas. A validação determinística é feita pelos scripts da infraestrutura:

```powershell
.\scripts\testar.ps1
```

A rotina não altera nem migra o PostgreSQL externo.
