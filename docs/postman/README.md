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
4. Crie/abra uma requisição gRPC e use `grpc://127.0.0.1:50051`.
5. Na aba **Service definition**, importe os `.proto` de `../../contratos/lixo_certo/v1/`; mantenha os imports no mesmo diretório.
6. Selecione o método desejado e use o JSON da pasta correspondente da coleção.

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

Se sua versão do Postman importar os itens `grpc://` como solicitações genéricas, use o mesmo nome, URL, mensagem e metadata para salvar a solicitação pelo cliente gRPC; a coleção continua servindo como inventário completo e fonte dos payloads.

Fontes oficiais consultadas:

- https://learning.postman.com/docs/use/send-requests/protocols/grpc/grpc-request-interface
- https://learning.postman.com/docs/use/send-requests/protocols/grpc/using-service-definition
- https://learning.postman.com/docs/use/send-requests/protocols/grpc/understanding-grpc-types
