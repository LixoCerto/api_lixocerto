# Catálogo inicial do Guia de descarte

## Situação editorial

Esta é uma **base inicial de curadoria**, não uma orientação pronta para publicação. O pacote contém **54 registros em 16 temas**, apoiados por **101 referências (66 URLs distintas)**. Todos entram no banco como `rascunho`, com data de verificação vazia e nota de revisão explícita. O seed não publica automaticamente nenhum item.

As referências e rotas locais são pontos de partida para revisão; não comprovam que qualquer ponto cadastrado aceite o material. Antes de publicar, uma pessoa revisora deve abrir as fontes, confirmar a relação entre cada afirmação e a referência, verificar vigência, município/operador, segurança e limites de aceitação. O guia deve recomendar confirmar a regra local quando não houver regra nacional clara.

## Cobertura do lote inicial

| Tema | Registros |
|---|---:|
| Papel e papelão | 3 |
| Vidro, espelhos e cerâmica | 4 |
| Plásticos e embalagens | 3 |
| Metais e latas | 3 |
| Restos alimentares e orgânicos de jardim | 3 |
| Óleo de cozinha usado | 4 |
| Eletroeletrônicos e eletrodomésticos | 4 |
| Pilhas e baterias portáteis/automotivas | 3 |
| Lâmpadas fluorescentes e LED | 3 |
| Medicamentos e embalagens | 3 |
| Roupas, calçados e têxteis | 3 |
| Pneus usados | 3 |
| Resíduos de construção e reforma | 4 |
| Tintas, solventes, aerossóis e químicos domésticos | 4 |
| Móveis e resíduos volumosos | 4 |
| Rejeitos sanitários, papel higiênico, fraldas e absorventes | 3 |
| **Total** | **54** |

Os temas reúnem tanto orientações gerais/logística reversa quanto exemplos municipais (por exemplo, serviços e programas locais). Esses exemplos não devem ser apresentados como cobertura nacional.

## Estrutura de cada material

O registro persiste nome, categoria, classificação/recorte, instrução, preparo, cuidados, impacto qualitativo, sinônimos para busca, abrangência e a **nota de escopo geográfico completa**, fontes, rotas citadas e trilha de revisão. A base inicial mantém em cada nota as ressalvas sobre município, operador, vigência e aceitação. `categoriasPontos` permanece separado das **rotas documentadas nas fontes**: uma rota citada não é uma relação confirmada com um ponto existente no sistema.

A API dá suporte a listar/consultar, criar, atualizar e mudar status. Edições voltam a rascunho; arquivar é reversível. Apenas usuários com a permissão de aprovação podem publicar. A API exige ao menos uma fonte para publicar, mas **não verifica automaticamente o conteúdo da fonte**.

## Arquivos e execução

- `banco/dados_iniciais/catalogo_materiais_br.json`: lote normalizado, com fontes por registro.
- `banco/dados_iniciais/003_inserir_catalogo_materiais_base.cjs`: seed idempotente; insere apenas códigos ainda ausentes e como rascunho.
- `banco/migracoes/027_enriquecer_catalogo_materiais.cjs`: campos aditivos de curadoria.
- `banco/migracoes/028_adicionar_permissao_aprovar_materiais.cjs`: permissão de aprovação para revisor/administrador em bancos existentes.

No ambiente Docker local, siga a ordem de build, migrations e seeds one-off documentada em `infra_lixocerto/README.md`, depois de confirmar o alvo do `.env` privado da API. O comando `pnpm integracao:banco` também existe para uma execução direta no host com dependências instaladas e variáveis de banco corretamente configuradas. Os seeds são idempotentes; repetir o seed do catálogo não duplica códigos já inseridos. Não rode rollback da migration 027 em banco com dados de curadoria que devam ser preservados: o `down` remove as colunas novas.

## Fontes e limites

A pesquisa não encontrou uma base brasileira única, aberta e completa que combine catálogo de materiais, instruções universais e pontos locais. O lote usa referências oficiais, municipais e de entidades de logística reversa; a procedência de cada URL está no próprio JSON e aparece no CRUD. O documento de pesquisa de fontes na raiz do repositório registra a avaliação do SINIR, ABREE, Green Eletron e OpenStreetMap: `guia-descarte-sources.md`.

O conteúdo não é aconselhamento de segurança para resíduos perigosos. Quando houver risco, produto químico, medicamento, perfurocortante ou regra municipal específica, a publicação deve deixar explícita a rota segura e a confirmação local necessária.
