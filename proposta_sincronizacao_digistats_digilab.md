# Integração entre DigiStats e DigiLab

> Plano revisado em 31/07/2026 com base na documentação pública da API do DigiLab: <https://digilab.cards/docs>.

## Decisão de arquitetura

Os torneios continuam sendo cadastrados no DigiStats e publicados manualmente no DigiLab, porque a API oficial é somente leitura: todos os endpoints documentados são `GET`.

A API deve ser usada imediatamente após a publicação para localizar o torneio, validar os dados importados e associar o registro externo ao torneio local. O Discord deixa de fazer parte do caminho principal; pode permanecer apenas como alternativa manual caso a API ainda não encontre uma publicação recente.

```text
DigiStats gera os standings
        ↓
Organizador publica no DigiLab
        ↓
Edge Function procura candidatos na API DigiLab
        ↓
Compara detalhes e standings
        ↓
Match único → associa os torneios
Ambiguidade ou divergência → revisão manual
```

## Contrato confirmado da API

- Base URL: `https://api.digilab.cards`.
- Autenticação: header `X-API-Key` em todas as requisições externas.
- Listagem: `GET /api/tournaments`.
- Detalhe e standings: `GET /api/tournament/{id}`.
- Limites: 60 requisições/minuto por IP e 300 requisições/minuto por chave.
- Em `429`, respeitar o header `Retry-After`; não repetir imediatamente.
- A API não é versionada. Campos novos podem surgir; o parser deve ignorar campos desconhecidos.
- Alterações incompatíveis devem ser anunciadas com pelo menos 30 dias, mas o changelog e o Discord ainda devem ser acompanhados.
- Listagens usam cache de borda de aproximadamente 15 minutos. Uma publicação recém-criada pode não aparecer imediatamente.
- Uso acadêmico e ferramentas comunitárias são permitidos. Se dados do DigiLab forem exibidos publicamente, incluir atribuição visível e link para `digilab.cards`.

### Atenção ao identificador

A listagem documenta o campo `tournament_id`, enquanto uma frase do parâmetro do endpoint de detalhe menciona genericamente o campo `id`. A implementação deve ler `tournament_id` da listagem e aceitar `id` apenas como fallback defensivo até um teste real confirmar o payload.

## Dados locais utilizados

### Torneio

- `tournament.id`, `tournament_name`, `tournament_date`, `store_id`, `format_id`, `total_players` e `rounds`.
- Resultados ordenados por `placement`.
- Pontos e recorde quando disponíveis localmente.
- Deck utilizado e link/lista quando disponíveis.
- Prints da Bandai arquivados no Supabase Storage.

### Jogador

- `name`: nome administrado e exibido no DigiStats.
- `digilab_name`: nome canônico para exportação e comparação com o DigiLab.
- `bandai_id`: Bandai Member Number enviado no fluxo manual quando cadastrado.

O detalhe público do DigiLab não retorna Bandai Member Number. Portanto, `bandai_id` ajuda na importação manual, mas não pode ser usado para confirmar a correspondência via API.

Na importação inversa, o identificador persistente deverá ser `player.slug`, associado explicitamente a `players.id`. Um fallback por `digilab_name` normalizado só poderá ser aceito quando produzir um único jogador local.

---

## Fase 0 — Validar acesso à API

### Objetivo

Confirmar a chave recebida e observar um payload real antes de criar banco ou interface adicionais.

### Implementação

1. Salvar a chave como secret do backend, por exemplo `DIGILAB_API_KEY`; nunca em JavaScript do navegador, `.env` versionado, logs ou mensagens de erro.
2. Executar pelo backend:

    ```http
    GET https://api.digilab.cards/api/tournaments?per_page=1
    X-API-Key: <secret>
    ```

3. Confirmar resposta `200`, JSON com `data` e `pagination`, e o nome real do campo identificador.
4. Buscar um torneio conhecido com `date_from`, `date_to`, `country=BR` e, se útil, `search=<loja>`.
5. Consultar `GET /api/tournament/{id}` e guardar um payload sanitizado como fixture de teste, sem chave ou dados desnecessários.

### Critério de conclusão

- Chave válida e secret `DIGILAB_API_KEY` configurado. Concluído em 31/07/2026.
- Edge Function diagnóstica `digilab-health` mantida para verificações manuais. Concluído em 31/07/2026.
- Listagem e detalhe testados com payload real.
- Campos e casos `null` relevantes registrados em testes de contrato.

O procedimento operacional da função de health está em `docs/features/digilab-integration.md`. Ela deve manter a verificação JWT do Supabase habilitada, não deve ser chamada automaticamente pelo frontend e nunca deve devolver a chave ou o payload completo.

---

## Versão 1 — Cópia manual dos standings

### Estado e objetivo

Esta versão já existe no DigiStats. Ela gera texto de um torneio salvo, copia para a área de transferência e permite colar os standings no formulário do DigiLab.

### Formato copiado

```text
1 PlayerName 0012345678 9
2 PlayerName 0012345678 7
```

| Valor     | Origem no DigiStats                                      |
| --------- | -------------------------------------------------------- |
| Colocação | `tournament_results.placement`                           |
| Nome      | `players.digilab_name`, com fallback para `players.name` |
| Bandai ID | `players.bandai_id`                                      |
| Pontos    | `tournament_results.match_points`                        |

Regras:

- Uma linha por participante, em ordem crescente de colocação.
- Preservar zeros à esquerda do Bandai ID.
- Bandai ID e pontos podem ficar vazios.
- Ausência de Bandai ID gera aviso, sem bloquear a cópia.
- Deck não faz parte desta primeira cópia.

### Validação ainda necessária

| Item                              | Resultado |
| --------------------------------- | --------- |
| Texto aceito                      | Pendente  |
| Colocação reconhecida             | Pendente  |
| `digilab_name` reconhecido        | Pendente  |
| Bandai ID reconhecido             | Pendente  |
| Pontos reconhecidos               | Pendente  |
| Campos ignorados ou rejeitados    | Pendente  |
| Mensagem apresentada pelo DigiLab | Pendente  |

---

## Versão 2 — Confirmação direta pela API

### Objetivo

Localizar um torneio recém-publicado no DigiLab, comparar seus dados com o torneio local e salvar a associação externa sem depender do Discord.

### Componente de backend

Criar uma Supabase Edge Function autenticada, por exemplo `verify-digilab-tournament`, que receba somente o `tournament_id` local. A função carrega os dados locais, consulta o DigiLab com a chave guardada nos secrets e devolve um resultado sanitizado.

O navegador nunca recebe a chave do DigiLab e não escolhe livremente URLs ou parâmetros de destino.

Uma primeira implementação está versionada em `supabase/functions/verify-digilab-tournament/index.ts` e foi criada manualmente no Supabase em 31/07/2026. Enquanto não houver autenticação administrativa no DigiStats, a invocação exige também `DIGILAB_VERIFY_TOKEN` no header `x-digilab-verify-token`; esse token é exclusivamente operacional e não pode ser incluído no frontend.

Validação real concluída em 31/07/2026: `tournament.id = 104` foi associado a `digilab_tournament_id = 7018` com status `matched`, usando consulta direta, uma requisição à API e um candidato comparado.

### Descoberta de candidatos

Consultar:

```http
GET /api/tournaments
    ?date_from=YYYY-MM-DD
    &date_to=YYYY-MM-DD
    &scene=curitiba
    &search=<nome da loja>
    &per_page=100
```

Regras sugeridas:

- Usar inicialmente a data exata do torneio.
- Tratar `search` apenas como redução de candidatos, pois ele busca nome de loja e diferenças de cadastro podem ocultar o torneio correto.
- Se a busca com loja retornar zero, repetir uma vez sem `search`, mantendo data, scene e paginação.
- Aplicar `format` somente após mapear o formato local para o identificador DigiLab; não assumir que os IDs dos dois sistemas são iguais.
- Paginar até `total_pages`, com teto operacional baixo para a janela exata de data.
- Não fazer polling contínuo. Permitir nova verificação manual e avisar que o cache da listagem pode atrasar a descoberta em cerca de 15 minutos.

Para cada candidato, consultar `GET /api/tournament/{id}` antes de decidir.

Quando o ID externo já for conhecido, a função pode receber `digilab_tournament_id` junto com o `tournament_id` local e consultar diretamente o detalhe. Os identificadores pertencem a namespaces diferentes e não devem ser comparados entre si. Toda associação automática deve ainda confirmar que `tournament.scene.slug` é `curitiba`.

### Critério de correspondência

Classificar os campos em vez de exigir igualdade indiscriminada:

| Campo                   | Regra                                                                      |
| ----------------------- | -------------------------------------------------------------------------- |
| Data                    | Obrigatoriamente exata                                                     |
| Quantidade de jogadores | Obrigatoriamente exata                                                     |
| Loja                    | Nome normalizado exato ou alias de loja previamente aprovado               |
| País/estado/cidade      | Confirmação adicional quando presentes                                     |
| Formato                 | Informativo; divergência não bloqueia vínculo ou importação                |
| Rodadas                 | Confirmação adicional, não bloqueante até validar regras dos dois sistemas |
| Standings               | Mesmas colocações e nomes normalizados para jogadores identificáveis       |
| Deck                    | Confirmação adicional quando presente nos dois sistemas                    |

O recorde agregado retornado pelo DigiLab permite preencher retroativamente `match_points` usando a regra local `wins × 3 + ties`. Esse cálculo recupera a pontuação acumulada, não dados rodada a rodada.

Normalização de nomes deve aplicar Unicode, caixa, espaços e pontuação de modo consistente, mas não deve fazer correspondência aproximada automática. Manter aliases explícitos quando o nome local e o `digilab_name` forem diferentes.

O DigiLab pode retornar jogadores como `Anonymous`, com `slug=null`. Esses registros não podem ser confirmados por nome; devem provocar revisão manual, salvo se os demais dados tornarem o candidato único e uma política específica for aprovada depois.

### Resultado da verificação

- `matched`: um único candidato passou por todos os campos obrigatórios e pelos standings verificáveis.
- `not_found`: nenhum candidato encontrado; orientar nova tentativa após o cache ou revisão dos filtros.
- `ambiguous`: mais de um candidato possível.
- `mismatch`: candidato encontrado, mas com divergências.
- `api_error`: falha de autenticação, limite ou indisponibilidade.

A resposta para a interface deve incluir apenas status, candidatos sanitizados e divergências por campo. Nunca repassar headers sensíveis ou a chave.

### Persistência proposta

Criar uma tabela dedicada, em vez de misturar o estado da integração ao registro principal:

```text
tournament_digilab_sync
  tournament_id                 PK/FK → tournament.id
  digilab_tournament_id         bigint UNIQUE NULL
  digilab_url                   text NULL
  status                        text
  verified_at                   timestamptz NULL
  last_checked_at               timestamptz NOT NULL
  last_error_code               text NULL
  comparison_summary            jsonb NULL
  created_at                    timestamptz NOT NULL
  updated_at                    timestamptz NOT NULL
```

A migration correspondente está em `database/migrations/20260731000000_create_tournament_digilab_sync.sql` e foi aplicada ao projeto remoto em 31/07/2026.

Restrições:

- `status` limitado aos cinco resultados definidos acima.
- Escrita somente pela Edge Function autorizada; leitura no frontend apenas dos campos necessários.
- Associação idempotente por `tournament_id` local e `digilab_tournament_id` externo.
- `comparison_summary` sem chave, headers ou payload integral; persistir somente diferenças úteis.
- URL externa construída a partir do ID validado, não aceita diretamente do cliente.

### Tratamento de erros e limites

- `401`: secret ausente ou header não enviado; erro de configuração.
- `403`: chave inválida, revogada ou inativa; bloquear novas tentativas automáticas e alertar administrador.
- `404`: candidato removido ou ID inválido; não associar.
- `429`: respeitar `Retry-After` e informar quando uma nova tentativa será permitida.
- `500`/rede: tentativa manual posterior; não apagar uma associação válida anterior.
- Aplicar timeout, quantidade máxima de páginas e quantidade máxima de detalhes por execução.
- Registrar métricas sem segredo: status HTTP, duração, número de candidatos e request ID, se fornecido.

### Testes mínimos

- Chave ausente, inválida e válida.
- Resposta com campos novos e campos opcionais `null`.
- Zero, um e vários candidatos.
- Loja com alias e loja divergente.
- Formato sem mapeamento.
- Jogador `Anonymous` e DNF.
- `429` com `Retry-After`.
- Listagem paginada.
- Reexecução idempotente de torneio já associado.

---

## Papel opcional do Discord

O fluxo antigo de ler mensagens de webhook não é mais necessário para descobrir IDs. Se mantido, deve ser apenas uma ferramenta administrativa de último recurso para capturar uma URL quando a publicação não aparece na listagem por cache ou filtros. A confirmação final deve sempre usar `GET /api/tournament/{id}`.

Isso evita manter token de bot, permissões de canal, cursor de mensagens e uma segunda integração externa sem necessidade.

---

## Evolução futura

Se o DigiLab publicar uma API oficial de escrita, a etapa manual poderá ser substituída por criação autenticada, idealmente com um identificador externo idempotente. Até lá, automação de navegador e endpoints internos não documentados permanecem fora do escopo.

## Ordem recomendada de execução

1. Configurar a chave como secret e concluir a Fase 0.
2. Validar o texto da Versão 1 no importador real do DigiLab.
3. Implementar a Edge Function sem persistência, retornando candidatos e diferenças.
4. Validar regras de normalização e mapeamento de formato com torneios reais.
5. Criar tabela, RLS e persistência idempotente.
6. Adicionar botão de verificação e estados na interface.
7. Documentar atribuição ao DigiLab onde seus dados forem exibidos.
