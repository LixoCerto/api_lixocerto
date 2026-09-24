# Incremento da Fase 4.2 — Questionários e progresso

## Implementado

O módulo de questionários agora possui modelos Sequelize para questões, alternativas e tentativas. A API lista somente questões publicadas e remove o campo interno que identifica a alternativa correta antes de enviar a resposta ao cliente.

A submissão valida a questão e a alternativa no backend, calcula a pontuação, retorna a explicação e registra a tentativa quando há usuário sincronizado. Uma resposta correta dispara a atualização do progresso persistido em `lcr_progresso_usuarios`.

O módulo de gamificação passou a calcular os níveis `iniciante`, `explorador`, `reciclador`, `agente_ambiental` e `guerreiro_ecologico`, além de armazenar pontos, nível e data da última atividade.

Também foi implementada a consulta gRPC do progresso individual. Sem identidade externa resolvida, a API não acessa o progresso de outro usuário e retorna apenas o estado inicial seguro.

## Métodos gRPC ligados

```text
ServicoQuestionarios.ListarQuestoes
ServicoQuestionarios.EnviarRespostaQuestionario
ServicoGamificacao.ObterProgressoUsuario
ServicoGamificacao.ObterRanking
```

## Validação executada

```text
Contratos Protobuf: OK
TypeScript estrito: OK
Compilação: OK
Testes: OK — 8 testes aprovados
Bootstrap gRPC: OK
```

## Limites atuais

O ranking ainda retorna uma coleção vazia até que a consulta agregada seja implementada com as regras de privacidade e ordenação aprovadas. A integração com banco real depende da execução das migrations em PostgreSQL separado.
