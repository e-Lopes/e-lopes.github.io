# Integração com o DigiLab

## Objetivo e estado atual

O DigiStats exporta standings para publicação manual no DigiLab e usa a API oficial para confirmar posteriormente que o torneio publicado corresponde ao registro local.

Estado em 31/07/2026:

- Exportação manual de standings implementada no frontend.
- Secret `DIGILAB_API_KEY` configurado nos secrets das Edge Functions.
- Conectividade e validade da chave confirmadas pela função `digilab-health`.
- Migration de persistência executada no projeto remoto em 31/07/2026.
- `DIGILAB_VERIFY_TOKEN` configurado e função `verify-digilab-tournaments` publicada no Supabase em 31/07/2026.
- Teste real concluído: torneio DigiStats `104` associado ao DigiLab `7018` com status `matched`, uma requisição externa e um candidato comparado.

O plano detalhado e os critérios de correspondência estão em [`proposta_sincronizacao_digistats_digilab.md`](../../proposta_sincronizacao_digistats_digilab.md).

## Contrato externo utilizado

- Documentação: <https://digilab.cards/docs>.
- Base URL: `https://api.digilab.cards`.
- Autenticação: `X-API-Key: <DIGILAB_API_KEY>`.
- Descoberta: `GET /api/tournaments`.
- Detalhe: `GET /api/tournament/{id}`.
- API somente leitura e sem versão fixa.
- Limites documentados: 60 requisições/minuto por IP e 300 por chave.
- Respostas `429` devem respeitar `Retry-After`.
- Listagens podem permanecer em cache por aproximadamente 15 minutos.

## Secret de produção

No Dashboard do Supabase, acessar **Edge Functions → Secrets** e cadastrar:

```text
DIGILAB_API_KEY=<chave emitida pelo DigiLab>
```

O secret é lido apenas no backend:

```ts
const apiKey = Deno.env.get('DIGILAB_API_KEY');
```

Regras:

- Não colocar a chave em `config/`, frontend, banco, logs ou respostas HTTP.
- Não versionar arquivos `.env`.
- Não usar nomes iniciados por `SUPABASE_`, prefixo reservado pela plataforma.
- A chave fica disponível para as Edge Functions logo após ser salva.

Para desenvolvimento local, usar um arquivo ignorado pelo Git, como `supabase/functions/.env`:

```env
DIGILAB_API_KEY=dl_k_exemplo
```

## Acesso ao Admin

A migration [`20260731010000_create_admin_users.sql`](../../database/migrations/20260731010000_create_admin_users.sql) cria a allowlist `public.admin_users`. A tela guarda a sessão apenas em `sessionStorage`; nenhuma senha ou refresh token é persistido no código do projeto.

O login pede somente a senha. Para o Supabase Auth identificar a conta sem um campo de usuário, o prefixo do e-mail técnico deve ser igual à senha em minúsculas.

| Pessoa          | E-mail técnico                   | Senha inicial |
| --------------- | -------------------------------- | ------------- |
| Marcio Braga    | `braga@admin.digistats.local`    | `braga`       |
| Lukas Fujisawa  | `fujisawa@admin.digistats.local` | `fujisawa`    |
| Matheus Fonseca | `fonseca@admin.digistats.local`  | `fonseca`     |
| Carlos Fortes   | `fortes@admin.digistats.local`   | `fortes`      |
| Eduardo Lopes   | `lopes@admin.digistats.local`    | `lopes`       |

As senhas não são criadas pela migration nem armazenadas em SQL. Criar os cinco usuários em **Authentication → Users → Add user**, marcar o e-mail como confirmado e então executar o bloco de associação fornecido junto da migration. E-mails técnicos não recebem recuperação de senha; redefinições são feitas pelo Dashboard.

O Admin mantém o login com um único campo. Credenciais antigas continuam usando o e-mail técnico derivado do sobrenome. Depois da primeira troca pelo botão **Trocar senha**, a Edge Function `change-admin-password` confirma a senha atual e altera senha e e-mail técnico em conjunto. O novo e-mail usa somente um hash SHA-256 da senha, permitindo qualquer combinação entre 3 e 72 caracteres sem expor seu conteúdo no endereço interno. Após a troca, todas as sessões locais são encerradas e o administrador entra novamente com a nova senha.

## Edge Function `digilab-health`

O código versionado está em [`supabase/functions/digilab-health/index.ts`](../../supabase/functions/digilab-health/index.ts).

A função faz uma única chamada:

```http
GET https://api.digilab.cards/api/tournaments?per_page=1
X-API-Key: <secret>
```

Ela não devolve a chave nem o payload de torneios. A resposta de sucesso contém apenas indicadores sanitizados:

```json
{
    "ok": true,
    "configured": true,
    "digilab_status": 200,
    "returned_items": 1,
    "pagination_received": true
}
```

Interpretação:

| Resultado                  | Significado                                                |
| -------------------------- | ---------------------------------------------------------- |
| `configured: false`        | Secret ausente ou salvo com outro nome                     |
| `digilab_status: 401`      | Header de autenticação não foi enviado corretamente        |
| `digilab_status: 403`      | Chave inválida, revogada ou inativa                        |
| `digilab_status: 429`      | Limite temporário atingido; observar `retry_after`         |
| `502` sem `digilab_status` | Falha de rede ou indisponibilidade antes de obter resposta |

### Uso operacional e segurança

- Manter a verificação JWT padrão do Supabase habilitada na implantação.
- Não chamar a função automaticamente no carregamento do frontend.
- Usar somente para diagnóstico manual pelo Dashboard do Supabase ou por operador autorizado.
- Cada teste consome uma requisição da cota do DigiLab.
- A função aceita `GET` e `POST`; outros métodos retornam `405`.
- No teste manual do Dashboard, enviar também `x-digilab-verify-token`. Pela aba Admin, o JWT do usuário substitui esse header.

## Ordem de implantação do Admin

1. Criar e confirmar os cinco usuários técnicos em **Authentication → Users**.
2. Executar `20260731010000_create_admin_users.sql` no SQL Editor.
3. Republicar `digilab-health`, `preview-digilab-import` e `verify-digilab-tournaments` com o código versionado.
4. Publicar o frontend com a nova aba Admin.
5. Entrar com uma senha provisória, abrir **DigiLab** e executar **Testar conexão**.

## Exportação manual

O módulo [`config/digilab-export.js`](../../config/digilab-export.js) transforma os resultados locais no texto aceito pelo fluxo manual:

```text
1 PlayerName 0012345678 9
2 PlayerName 0012345678 7
```

O nome usa `players.digilab_name`, com fallback para `players.name`. A ausência de Bandai ID gera aviso, mas não impede a cópia.

## Persistência da associação

A migration [`20260731000000_create_tournament_digilab_sync.sql`](../../database/migrations/20260731000000_create_tournament_digilab_sync.sql) cria `public.tournament_digilab_sync`.

Uma linha passa a existir somente após a primeira tentativa de verificação. A ausência de linha significa `not_checked`.

Estados persistidos:

- `matched`: vínculo confirmado e identificador externo salvo.
- `not_found`: nenhum candidato encontrado.
- `ambiguous`: mais de um candidato possível.
- `mismatch`: candidato encontrado com divergências.
- `api_error`: falha de autenticação, limite ou disponibilidade.

Somente `service_role`, usado pela futura Edge Function de integração, pode escrever. Clientes `anon` e `authenticated` podem ler apenas ID local, ID/URL DigiLab, status e datas de verificação. `comparison_summary` e `last_error_code` não são concedidos ao frontend.

## Edge Function `verify-digilab-tournaments`

O código está em [`supabase/functions/verify-digilab-tournament/index.ts`](../../supabase/functions/verify-digilab-tournament/index.ts).

### Autorização

As três funções aceitam um JWT de usuário autenticado cuja identidade esteja na allowlist `public.admin_users`. A aba **Admin → DigiLab** usa esse caminho e nunca recebe os secrets da integração.

Para testes manuais no Dashboard, continua disponível o segundo secret operacional:

```text
DIGILAB_VERIFY_TOKEN=<valor aleatório longo e exclusivo>
```

O token deve ser enviado no header `x-digilab-verify-token` somente em testes manuais pelo Dashboard. Ele não pode ser colocado no frontend. A verificação JWT padrão da Edge Function também deve permanecer habilitada.

O header operacional deve permanecer restrito a testes no Supabase. Em produção, operadores usam sua sessão individual.

### Entrada

Descoberta automática pelo torneio local:

```json
{
    "tournament_id": 123
}
```

Comparação direta quando o ID externo já é conhecido:

```json
{
    "tournament_id": 123,
    "digilab_tournament_id": 7018
}
```

`tournament_id` é sempre o ID local do DigiStats. `digilab_tournament_id` é o ID global do DigiLab; os valores não precisam e normalmente não irão coincidir.

### Proteções e limites

- Cooldown de 15 minutos por torneio após cada tentativa.
- Torneios já associados retornam o vínculo salvo sem consultar a API novamente.
- Descoberta limitada à scene `curitiba`, com uma busca por loja e, somente se necessário, uma busca de fallback sem loja.
- Quando `digilab_tournament_id` é informado, a listagem é ignorada e somente um detalhe é consultado.
- No máximo 10 consultas de detalhe por execução.
- Máximo normal de 12 requisições DigiLab por execução.
- Nenhum polling ou retry automático.
- `429` interrompe a execução e repassa `Retry-After`.
- O cooldown interno é ignorado somente em uma confirmação manual autenticada (`force_match`); a função ainda refaz a consulta de detalhe antes de salvar.

### Correspondência inicial

A primeira versão é conservadora e exige igualdade de:

- data;
- quantidade de jogadores;
- loja após normalização de caixa, acentos, espaços e pontuação;
- código de formato apenas como informação, sem bloquear o vínculo;
- quantidade de standings;
- nome e colocação de todos os jogadores;
- ausência de DNF no DigiLab.
- scene DigiLab igual a `curitiba`.

Se houver diferenças nos campos obrigatórios, o status será `mismatch`. Jogadores `Anonymous` também impedem a associação automática. Os nomes das lojas foram padronizados manualmente entre os dois sistemas em 31/07/2026; não há necessidade imediata de uma tabela de aliases de loja.

Quando o DigiLab devolve colocações repetidas por empate completo, a comparação por posição deixa de ser válida. Nesse caso excepcional, a função compara o conjunto completo de jogadores e registra `tied_placements` como aviso; o modelo local continua armazenando posições sequenciais e únicas.

Um administrador pode resolver um `mismatch` pela aba DigiLab usando **Confirmar vínculo após revisão**. A requisição envia `force_match: true` junto dos dois IDs, consulta novamente o detalhe externo e salva o vínculo como `matched`. O `comparison_summary` preserva `source = admin_manual_override`, `manual_override = true` e `accepted_mismatches` para auditoria.

### Implantação e teste

1. Adicionar `DIGILAB_VERIFY_TOKEN` em **Edge Functions → Secrets**.
2. Criar ou publicar a função `verify-digilab-tournaments` mantendo a verificação JWT habilitada.
3. No teste do Dashboard, usar `POST`, enviar o header `x-digilab-verify-token` e o body com o ID local.
4. Confirmar a resposta e a linha criada em `tournament_digilab_sync`.

## Próximas etapas

1. Testar descoberta automática sem fornecer `digilab_tournament_id`.
2. Testar casos `not_found`, `mismatch` e `ambiguous` de forma controlada.
3. Validar novamente os nomes de loja após a padronização manual.
4. Implementar prévia e confirmação da importação DigiLab → DigiStats.
5. Exibir status e link do DigiLab nos detalhes do torneio.

## Edge Function `preview-digilab-import`

O código read-only está em [`supabase/functions/preview-digilab-import/index.ts`](../../supabase/functions/preview-digilab-import/index.ts). A consulta de inventário exige uma sessão de admin autorizada ou o header operacional de testes. A consulta de um único torneio por `digilab_tournament_id` também aceita a chave pública do aplicativo, permitindo preencher o modal **Novo torneio** a partir de uma URL DigiLab sem exigir acesso ao Admin.

Sem um ID externo, ela lista uma página do inventário da scene Curitiba:

```json
{
    "page": 1,
    "per_page": 100
}
```

Cada item contém ID DigiLab, data, quantidade de jogadores, loja, formato, vínculo existente e candidatos locais da mesma data. A classificação usa quantidade de jogadores, loja e formato para resolver dias com mais de um evento.

Com um ID, ela busca uma prévia detalhada sem escrever no banco:

```json
{
    "digilab_tournament_id": 7018
}
```

A prévia valida a scene, retorna standings/DNFs sanitizados, informa candidatos locais e marca impedimentos conhecidos, como jogador anônimo ou DNF. Cada modo realiza somente uma requisição ao DigiLab e respeita `Retry-After` sem retry automático. Diferença de formato é informativa e não bloqueia vínculo ou importação.

### Aba Admin → DigiLab

A aba administrativa oferece:

- teste manual do health;
- inventário paginado da scene Curitiba;
- totais por situação de mapeamento;
- consulta direta por ID DigiLab;
- detalhe sanitizado, standings e pontuação derivada;
- confirmação do vínculo quando existe exatamente um candidato local compatível.
- vínculo automático e sequencial dos candidatos exatos, com intervalo de 1,3 segundo entre chamadas;
- explicação dos motivos de `Revisar validação` e confirmação administrativa auditável do vínculo;
- distinção entre vínculo confirmado, dados ainda não revisados e dados já sincronizados;
- auditoria dos decks ao abrir os detalhes, mostrando decks ausentes ou divergentes no DigiStats antes da sincronização;
- criação automática de torneios novos quando loja, formato e todos os jogadores estão resolvidos;
- de-para persistente por `player.slug`, com seleção manual apenas para nomes não resolvidos.
- de-para persistente por `deck.slug`, preenchendo `tournament_results.deck_id` e permitindo seleção manual quando o nome do arquétipo divergir.

Entrar na aba e trocar de página apenas carregam dados. O botão **Atualizar inventário** continua executando os vínculos exatos e as importações resolvidas sob demanda. O processamento manual é sequencial e não faz polling. O cooldown local pula apenas o candidato afetado e permite processar os demais; um `429` real do DigiLab interrompe a sequência e respeita `Retry-After`.

### Importação em background

A Edge Function `sync-new-digilab-tournaments` é chamada a cada 15 minutos por `pg_cron`, sem depender de navegador ou sessão administrativa. Ela consulta a primeira página da scene Curitiba, registra os itens **Novo no DigiStats** em `digilab_background_imports` e processa no máximo oito por execução. A listagem oficial possui cache de 15 minutos, por isso uma frequência menor não anteciparia de forma confiável a descoberta.

Somente torneios com loja, formato e decks totalmente resolvidos e sem candidato local conflitante são importados. Jogadores inequivocamente novos são cadastrados automaticamente antes de uma nova validação e da criação do torneio. Itens ambíguos ou incompletos recebem `needs_review` e voltam a ser avaliados depois de seis horas; erros transitórios usam `retry`, respeitando `Retry-After`. A importação continua transacional e idempotente pela função existente `import-digilab-tournament`. O job usa dois segredos no Vault (`digilab_background_sync_url` e `digilab_background_sync_token`), e a Edge Function compara o token com `DIGILAB_BACKGROUND_SYNC_TOKEN`.

O botão **Sincronizar dados pendentes** processa em lote tanto os torneios já vinculados quanto os itens **Novo no DigiStats** da página atual. Para cada item, ele carrega a prévia e exige loja, formato, jogadores e decks com de-para completo. Torneios vinculados recebem a atualização idempotente de `deck_id` e `match_points`; torneios novos são criados com seus participantes, classificação, decks e pontos. O painel mostra progresso, permite interromper após o item atual e deixa torneios incompletos marcados para revisão. As chamadas são sequenciais, com intervalo de 1,3 segundo, para permanecer abaixo do limite por IP do DigiLab.

Quando a prévia encontra nomes DigiLab sem jogador local, os detalhes exibem a lista em **Jogadores ainda não cadastrados**. O botão **Cadastrar jogadores** pede confirmação mostrando todos os nomes e faz uma inserção única no cadastro existente de `players`. Cada novo jogador recebe inicialmente o mesmo valor em `name`, `bandai_nick` e `digilab_name`; `bandai_id` permanece `NULL`. Após a criação, a prévia é recarregada para resolver o de-para por nome exato. Casos anônimos, sem slug, ambíguos ou com nomes externos duplicados continuam disponíveis apenas para revisão manual.

O botão **Detalhes** funciona como alternador: um segundo clique no mesmo torneio fecha a linha expandida.

A criação inversa exige a Edge Function `import-digilab-tournament`, cujo código está em [`supabase/functions/import-digilab-tournament/index.ts`](../../supabase/functions/import-digilab-tournament/index.ts). Ela usa `import_digilab_tournament_transaction`, de modo que torneio, resultados, vínculo e mapeamentos sejam gravados ou revertidos juntos. Se a função estiver ausente ou indisponível, o lote para no primeiro erro sistêmico e nenhum outro torneio é tentado.

Na criação do torneio, os tipos externos são convertidos para os nomes aceitos pelo DigiStats: `locals` vira **Semanal** e `evo_cup` vira **Evo Cup**. Tipos ausentes ou ainda não reconhecidos usam **Semanal** como padrão. A migration `20260801000000_map_digilab_tournament_types.sql` faz o primeiro ajuste retroativo nos torneios vinculados. A migration `20260801010000_normalize_tournament_types.sql` amplia o backfill para qualquer registro legado com esses aliases e instala um trigger no banco, garantindo a conversão também em futuros inserts e updates, independentemente da versão do cliente ou da Edge Function.

A migration `20260731040000_add_digilab_deck_sync.sql` cria `digilab_deck_sync` e torna a importação idempotente também para resultados: chamar novamente a função para um torneio já vinculado atualiza decks e pontos pelo `player_id`, sem criar outro torneio. Na prévia de um vínculo existente, o botão **Sincronizar dados** executa esse backfill.

### Famílias e catálogo de decks

O DigiStats adota dois níveis, sem tags:

```text
Família
└── Arquétipo específico
```

`deck_families` contém famílias como `Mastemon`; `decks` continua sendo o arquétipo usado no resultado, como `Mastemon (Tribal)` ou `CS Mastemon`, e recebe `family_id`. `tournament_results.deck_id` não muda, preservando todas as referências históricas e as estatísticas atuais por arquétipo.

`digilab_deck_catalog` espelha os dados retornados por `/api/meta?format=all&group_by=archetype`, incluindo ID/slug, família, cores e carta representativa. O espelho não usa IDs DigiLab como chave das tabelas locais. `digilab_deck_sync` faz o vínculo revisado entre o slug externo e `decks.id`.

A Edge Function `digilab-deck-catalog` possui cinco ações autenticadas:

- `list`: lê o catálogo salvo sem consumir a API DigiLab;
- `sync`: pagina o catálogo oficial, atualiza famílias e arquétipos externos e retorna a comparação;
- `map`: vincula um arquétipo externo a um deck local e atribui sua família;
- `create`: cria um arquétipo local a partir do catálogo e salva o vínculo.
- `map_exact_names`: cria em lote somente vínculos de nome normalizado igual, com uma única correspondência local e cujo deck já tenha resultados no DigiStats.

Na aba **Admin → DigiLab**, o card **Catálogo de decks DigiLab** diferencia mapeados, nomes iguais e itens sem correspondente, com filtros por busca, situação e família. A listagem operacional mostra somente arquétipos associados a decks que já aparecem nos resultados do DigiStats; itens globais do DigiLab sem uso local ficam ocultos. Arquétipos novos encontrados nos torneios de Curitiba continuam sendo tratados durante a prévia/importação do torneio. A criação nunca é automática para nomes divergentes. A migration `20260731050000_create_deck_families_and_digilab_catalog.sql` também cria `v_deck_family_stats`; decks ainda não classificados permanecem como grupos próprios, sem desaparecer dos relatórios.

Quando um candidato local possui menos participantes que o torneio DigiLab, o Admin oferece **Adicionar ausentes**. A reconciliação exige a mesma data e loja, reutiliza o de-para revisado, adiciona resultados ausentes e atualiza posição, deck e pontos dos participantes presentes no DigiLab. Resultados locais excedentes não são excluídos automaticamente. A operação é transacional pela migration `20260731060000_reconcile_digilab_tournament_results.sql` e registra sua origem em `tournament_digilab_sync.comparison_summary`.

### Pontuação retroativa

O endpoint de detalhe retorna o recorde agregado de cada jogador (`wins`, `losses`, `ties`), mas não uma lista documentada de rodadas. Como o DigiStats usa 3 pontos por vitória e 1 por empate, a prévia calcula:

```text
match_points = wins × 3 + ties
```

O valor é devolvido com `match_points_source = derived_3_win_1_tie`. Na importação definitiva, ele poderá preencher `tournament_results.match_points`; se o recorde estiver ausente ou inválido, o campo permanece `NULL`.

Isso recupera a pontuação acumulada, não o histórico de cada rodada. Um histórico por rodada exigiria um novo modelo local e um endpoint oficial que exponha partidas individuais.

### Identidade dos jogadores

A API pública não retorna Bandai Member Number. O detalhe expõe `player.name` e `player.slug`; portanto, o fluxo inverso não pode fazer match por `players.bandai_id`.

Ordem recomendada:

1. Mapeamento persistido de `digilab_player_slug` para `players.id`.
2. Fallback exato por `players.digilab_name` normalizado, somente quando houver um único resultado.
3. Revisão manual em caso de ausência, duplicidade, mudança de nome ou jogador `Anonymous`.

O Bandai ID continua prioritário nos fluxos originados por OCR/TCG+, onde o dado está presente.

### Inventário real de Curitiba — página 1

Teste realizado em 31/07/2026 com 100 dos 163 torneios retornados:

- 1 já vinculado: DigiLab `7018` → DigiStats `104`.
- 58 candidatos locais exatos por data, jogadores, loja e formato.
- 33 candidatos que divergiam apenas por nome de loja no momento do teste:
    - `Taverna Game House` → `Taverna` em 23 casos.
    - `Rei das Cartinhas` → `Rei das Cartinhas (Celta)` em 10 casos.
- Os nomes dessas lojas foram ajustados manualmente nos dois sistemas após o teste.
- DigiLab `6032` diverge do candidato local no formato (`BT23` × `BT24`), diferença agora considerada apenas informativa.
- DigiLab `6107` diverge do candidato local na quantidade de jogadores (17 × 14).
- Em 27/06/2026 há dois torneios DigiLab: `6306` (Meruru, 5 jogadores, EX09) e `5920` (Rei das Cartinhas, 4 jogadores, BT25). Apenas `5920` possui candidato local; `6306` deve ser tratado como nova importação.
- Outros cinco torneios da página não possuem candidato local.

O classificador foi ajustado para que um registro apenas na mesma data, mas com score zero nos demais campos, permaneça `new_import`.
