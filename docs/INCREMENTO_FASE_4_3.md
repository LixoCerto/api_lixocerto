# Incremento da Fase 4.3 — Avaliação SUS e ranking seguro

## Implementado

A avaliação SUS agora valida consentimento, exatamente dez notas inteiras entre 1 e 5 e um código de participante. O código não é armazenado em texto puro: antes da persistência, é transformado em hash SHA-256 usando `SEGREDO_HASH_PARTICIPANTE`, que deve ser fornecido por um secret manager em produção.

A sessão e as dez respostas são gravadas em uma transação nas tabelas `lcr_sessoes_avaliacao` e `lcr_respostas_sus`. O serviço calcula a pontuação SUS e oferece resultados agregados com quantidade de participantes, média e mediana.

O método de resultados agregados exige autenticação OIDC e a permissão `avaliacao_usabilidade:consultar_agregados`. O ranking da gamificação consulta somente usuários ativos, aplica limite de até 50 registros e retorna pseudônimos sequenciais, sem expor nomes ou e-mails reais.

## Métodos gRPC ligados

```text
ServicoAvaliacaoUsabilidade.EnviarAvaliacaoSus
ServicoAvaliacaoUsabilidade.ObterResultadosAgregados
ServicoGamificacao.ObterRanking
```

## Validação executada

```text
Contratos Protobuf: OK
TypeScript estrito: OK
Compilação: OK
Testes: OK — 12 testes aprovados
Bootstrap gRPC: OK
```

## Limites atuais

A execução das migrations e a validação com PostgreSQL real continuam pendentes de um banco separado. A coleta com participantes só deve ser iniciada após aprovação do protocolo e consentimento institucional aplicável.
