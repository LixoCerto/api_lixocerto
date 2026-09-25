# Postman nativo — Lixo Certo API gRPC

A API Lixo Certo expõe **22 métodos gRPC em 13 serviços** no pacote `lixo_certo.v1`. Ela não possui rotas REST equivalentes. Para que o Postman mostre **Invoke**, e não `POST`/`Send`, cada item precisa ser criado pelo cliente gRPC nativo do Postman e salvo em uma coleção a partir de **New > gRPC**.

## O que é entregue pelo repositório

O arquivo `Lixo-Certo-API.postman_environment.json` contém apenas variáveis locais sem credenciais reais. O arquivo `Lixo-Certo-API.postman.proto` é uma definição raiz que agrega os contratos Protobuf dos 13 serviços. O arquivo `Lixo-Certo-API.grpc.manifest.json` é um catálogo de configuração com os 22 métodos, mensagens e metadados; ele é deliberadamente marcado como `importavelComoCollectionJson: false` e **não deve ser importado como coleção**.

O artefato `legado/Lixo-Certo-API.legado-http.postman_collection.json` é mantido somente para auditoria histórica. Ele contém itens HTTP `POST` e não representa uma coleção gRPC nativa. O script de preparação não o copia para o diretório do Postman.

## Preparação automática no Windows

A partir de `G:\LixoCerto\infra_lixocerto`, execute:

```powershell
.\scripts\iniciar.ps1 -Aplicacao -PrepararPostman -SmokeTests
```

O comando sobe o Docker local, habilita server reflection somente no ambiente de desenvolvimento, copia os contratos para `%USERPROFILE%\Postman\files\lixo-certo`, copia a definição raiz, o ambiente e o catálogo, e remove uma coleção HTTP antiga que tenha ficado no diretório de trabalho.

## Criação da coleção nativa no Postman

Depois da preparação, selecione o ambiente `Lixo Certo — API local — gRPC` e siga este fluxo no Postman Desktop:

1. Abra **New > gRPC**.
2. Informe `grpc://{{grpc_host}}`, que resolve para `grpc://127.0.0.1:50051`.
3. Aguarde o server reflection carregar os serviços e métodos. Se a sua versão não carregar reflection, abra a aba **Service definition**, importe `Lixo-Certo-API.postman.proto` e mantenha o diretório de trabalho preparado.
4. Selecione um método. Para uma chamada unary, o botão correto será **Invoke**.
5. Use a mensagem e os metadados correspondentes no `Lixo-Certo-API.grpc.manifest.json`.
6. Use **Save As** e salve em uma coleção chamada `Lixo Certo — API gRPC — Nativa`. Organize os itens por serviço.

Repita os passos 4 a 6 para os 22 métodos do catálogo. O endpoint, a definição Protobuf, a mensagem e os metadados são preservados pela requisição gRPC nativa; nenhum item deve ter método HTTP `POST`, cabeçalho `Content-Type: application/grpc+json` ou URL HTTP.

O Postman não oferece atualmente um formato público e confiável para exportar/importar essas requisições nativas como Collection JSON v2.1. Por esse motivo, o repositório não finge entregar uma coleção JSON importável: ele automatiza o ambiente, os contratos, a descoberta por reflection, os payloads e a conferência dos 22 métodos, enquanto o cliente Postman faz o salvamento nativo no workspace.

## Autorização

Os métodos públicos incluem saúde, materiais, pontos de coleta, listagem de questões, ranking e envio SUS. Os demais exigem Bearer JWT ou metadados específicos. No ambiente Docker local, o Keycloak em `http://localhost:8081` emite os tokens do realm `lixo-certo`. A partir de `infra_lixocerto`, execute `.\scripts\obter-token-postman.ps1` para preencher automaticamente `jwt_token` no ambiente local do Postman; use `-Administrador` para testar permissões administrativas. O script não imprime nem versiona o token. Cada RPC protegido deve conter na aba **Metadata**: `authorization` = `Bearer {{jwt_token}}`. O catálogo informa os metadados esperados para cada método.

## Endpoint correto

Use `grpc://127.0.0.1:50051` para o cliente gRPC nativo do Postman. A porta `8080` é o gateway Envoy gRPC-Web usado pelo frontend e não substitui a API gRPC nativa. O frontend fica em `http://127.0.0.1:3000`.

## Validação automatizada

O Postman é usado para inspeção visual e chamadas interativas. A validação determinística não depende da interface do Postman:

```powershell
.\scripts\testar.ps1
```

O resultado esperado é `Smoke gRPC: 5/5 aprovados`. O runner usa diretamente `127.0.0.1:50051` e não altera nem migra o PostgreSQL externo.

## Referências

As fontes oficiais e as limitações de exportação estão registradas em [`docs/REFERENCIAS_POSTMAN_GRPC.md`](../../../infra-lixo-certo/docs/REFERENCIAS_POSTMAN_GRPC.md), incluindo a documentação da interface gRPC, das definições Protobuf e as issues oficiais de exportação.
