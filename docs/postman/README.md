# Coleção Postman — Lixo Certo API gRPC

A API expõe **22 métodos gRPC em 13 serviços** no pacote `lixo_certo.v1`. Não existem rotas REST equivalentes neste projeto.

## Arquivos

- `Lixo-Certo-API.postman_collection.json`: coleção v2.1 organizada por serviço.
- `Lixo-Certo-API.postman_environment.json`: ambiente local sem credenciais reais.
- `../../contratos/lixo_certo/v1/*.proto`: definições Protobuf usadas como service definition.

## Importação

1. Abra o Postman Desktop.
2. Importe `Lixo-Certo-API.postman_collection.json` e `Lixo-Certo-API.postman_environment.json`.
3. Selecione o ambiente `Lixo Certo — API local — gRPC`.
4. Selecione o ambiente `Lixo Certo — API local — gRPC`; ele já está configurado para o Docker local (`grpc_host=127.0.0.1:50051`, `gateway_url=http://127.0.0.1:8080`, `frontend_url=http://127.0.0.1:3000`).
5. Crie/abra uma requisição gRPC e use `grpc://{{grpc_host}}` ou `grpc://127.0.0.1:50051`.
6. Na aba **Service definition**, importe os `.proto` de `../../contratos/lixo_certo/v1/`; mantenha os imports no mesmo diretório.
7. Selecione o método desejado e use o JSON da pasta correspondente da coleção.

O Postman utiliza o JSON para compor mensagens Protobuf e precisa de uma definição de serviço para conhecer métodos e tipos. A documentação oficial confirma que o cliente gRPC usa URL `grpc://`, definição `.proto`, payload JSON e metadata.

## Autorização

- **Públicos:** saúde, materiais, pontos de coleta, listagem de questões, ranking e envio SUS.
- **Bearer JWT:** autenticação, identidade, desafios, avaliação agregada, perfil, sessões, auditoria e administração. Preencha `jwt_token` sem incluir o token em arquivos versionados.
- **Metadata `x-id-usuario-externo`:** resposta de questionário e progresso de gamificação.
- **Metadata `x-id-correlacao`:** opcional nas mutações de desafios e auditoria.
- **Metadata `x-id-sessao`:** opcional para marcar a sessão atual na listagem de sessões.

## Ordem recomendada de teste

1. `ServicoSaude/Verificar`.
2. `ServicoMateriais/ListarMateriais` e `ServicoPontosColeta/ListarPontosColeta`.
3. `ServicoQuestionarios/ListarQuestoes`.
4. Preencher `jwt_token` e testar autenticação, perfil e identidade.
5. Testar desafios, questionários e progresso com IDs existentes retornados pelo banco.
6. Testar auditoria e administração somente com permissões adequadas.

## Observações

Os UUIDs no ambiente são exemplos e precisam ser substituídos por IDs existentes quando o método consultar um registro real. A coleção não contém senha de banco, token JWT, chave privada ou qualquer segredo real.

## Docker local

O Postman deve usar a porta `50051`, porque ele faz chamadas gRPC nativas diretamente à API. A porta `8080` é o gateway Envoy gRPC-Web usado pelo frontend e não substitui o endpoint gRPC nativo do Postman. O frontend fica disponível em `http://127.0.0.1:3000` e o Redis em `127.0.0.1:6379`; esses valores ficam no ambiente apenas como referência operacional.

Se sua versão do Postman importar os itens `grpc://` como solicitações genéricas, use o mesmo nome, URL, mensagem e metadata para salvar a solicitação pelo cliente gRPC; a coleção continua servindo como inventário completo e fonte dos payloads.

Fontes oficiais consultadas:

- https://learning.postman.com/docs/use/send-requests/protocols/grpc/grpc-request-interface
- https://learning.postman.com/docs/use/send-requests/protocols/grpc/using-service-definition
- https://learning.postman.com/docs/use/send-requests/protocols/grpc/understanding-grpc-types
