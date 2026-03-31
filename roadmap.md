# DigiStats Roadmap (Project State)

## Current Score

**8.8 / 10**

Os 4 bugs imediatos da sessão anterior foram fechados: RLS DELETE em `formats` (policy adicionada no Supabase), migration de paths legados executada, OCR migrado para Vercel (`digimon-ocr-api.vercel.app`) e validado, cache de formato default no modal de edição de torneio corrigido e testado. As dívidas técnicas que puxavam a nota para baixo estão eliminadas. O projeto está sólido nos fluxos core com poucos gaps restantes de alta visibilidade.

---

## Area Scores & Gaps (Mar 31, 2026)

### Deckbuilder — 8 / 10
**O que funciona bem:** import com normalização de códigos (AA, _P, BT4-104C), filtros de tipo/cor/level/cost/set/texto, layout 2 colunas sem compressão, meta pills com ícones, drag-and-drop, save warning, zoom modal, mobile funcional.

**O que falta:**
- API search pública com qualidade inconsistente — às vezes não retorna resultados esperados; investigar parâmetros da digimoncard.io e melhorar matching por nome parcial
- Abertura do deckbuilder mais direta — hoje requer navegar para a tela de resultados e clicar no player. Falta uma forma de abrir um deck existente diretamente da lista de decklists
- Mobile em 480px/414px não auditado — breakpoints cobrem 768px e 1180px, mas telas menores têm gaps não críticos mas presentes
- Card payload fetch da API pública ao salvar: funciona mas sem retry ou feedback de erro detalhado ao usuário

---

### Admin Panel — 8 / 10
**O que funciona bem:** CRUD de formatos com upload de background, bucket browser, deactivate/activate inline, default management, ban list editor, store CRUD parcial. DELETE com RLS funcionando. Paths legados de bucket corrigidos via migration.

**O que falta:**
- Store CRUD: falta listagem de lojas no admin com edição inline de `logo_url`, `instagram_link`, `is_active`
- Sem feedback de loading nos botões da tabela de formatos (Deactivate, Set Default) — UX deixa o usuário sem saber se a ação ocorreu

---

### Post Generator — 8 / 10
**O que funciona bem:** geração de posts top4, distribuição, template editor, backgrounds dinâmicos do DB, upload para bucket, custom backgrounds, canvas export.

**O que falta:**
- `formatBackgroundMapPromise` é cache de sessão — se um novo formato for cadastrado no admin durante a mesma sessão do post generator, o selector não atualiza. Precisa de um botão "Refresh" ou invalidação ao fechar/abrir o selector
- Sem estado de loading visível enquanto `initializeBackgroundSelector` busca do DB na inicialização

---

### Estatísticas — 9 / 10
**O que funciona bem:** 7 views (decks, meta, cores, top cards, players, lojas, representação), donut chart, bar chart, sparklines, HHI diversity score, top cards por deck, card preview, cobertura de decklists, ranking mensal.

**O que falta:**
- **Player deck profile** — `unique_decks_used` é só um contador. Falta mostrar quais decks o player usou e os resultados por deck (títulos, top4s, winrate estimado)
- **Consistency metric** — um deck que entrou em top4 em 3 torneios seguidos é muito diferente de um que entrou uma vez. "Top4 streak" ou "eventos desde último top4" seria diferenciador
- **Store attendance trends** — evolução do número de jogadores por torneio por loja ao longo do tempo. Responde "o cenário local está crescendo?"
- **Estatísticas mobile em 375px** — tabelas com muitas colunas (top cards, deck performance) transbordam horizontalmente sem scroll visível

---

---

### Torneios (criação, listagem, edição) — 9 / 10
**O que funciona bem:** create/edit/list completos, OCR import, format default na criação, exportação de resultados, detalhes expandíveis, filtros por loja/formato/mês.

**O que falta:**
- Sem validação ao salvar torneio com 0 resultados registrados
- Expandir Lojas button: visível apenas quando ranking por loja estiver selecionado — feito mas marcado como "precisa revisão"

---

### CSS / Design System — 6.5 / 10
**O que funciona bem:** dark mode cobre a maioria das telas, breakpoints principais cobertos, componentes consistentes (pills, chips, modais).

**O que falta:**
- `styles.css` com ~15k linhas — maior risco de regressão do projeto. Qualquer mudança CSS pode afetar 3 telas sem querer
- Light mode muito brilhante — `#fff` e `#f8fbff` precisam de uma passagem para off-whites (`#f7f8fc`, `#f4f5fb`)
- `!important` em excesso — maioria compensa specificity fights que deveriam ser resolvidos na origem
- CSS custom properties como source of truth para cores de tema: não implementado
- Dark styles ainda "vazam" em alguns componentes novos que não recebem override

---

### Players — 7.5 / 10
**O que funciona bem:** listagem, cadastro via modal, histórico, ranking, deck profile básico.

**O que falta:**
- Ver decks usados por player com performance por deck
- Foto/avatar do player (campo existe no esquema?)
- Busca de player por nome incompleto é case-sensitive em alguns contextos

---

### Infraestrutura / Qualidade — 6 / 10
**O que funciona bem:** cache busting consistente, SW versionado, Supabase views para queries pesadas.

**O que falta:**
- **Sem testes automatizados** — zero cobertura. Um bug em `normalizeDeckCode` pode silenciosamente quebrar imports de todos os usuários
- RLS de outras tabelas não auditado completamente — apenas `formats` foi verificado e corrigido
- **Sem monitoramento do OCR** — taxa de falha desconhecida em produção (endpoint migrado para Vercel)
- Lint não enforced no CI

---

## Priority Order (atualizado Mar 31, 2026)

> ~~1. Fix RLS DELETE na tabela `formats`~~ ✅
> ~~2. Trocar endpoint OCR para `digimon-ocr-api.vercel.app`~~ ✅
> ~~3. Migration one-shot para limpar `formats/` legados no DB~~ ✅
> ~~4. Revisar modal de edição de torneio — cache stale de formato default~~ ✅
> 1. **Deckbuilder API search quality** — melhorar matching e feedback quando nenhum resultado é encontrado
> 2. **Player deck profile** nas estatísticas
> 3. **CSS modularização** — split `styles.css` em arquivos por seção antes que cresça mais

---

## Recent Wins (Mar 31, 2026 — follow-up)

**4 bugs imediatos fechados:**
- **RLS DELETE em `formats`** — policy adicionada no Supabase dashboard; botão Delete funcional.
- **OCR endpoint** — migrado de HuggingFace para `digimon-ocr-api.vercel.app` em `list-tournaments/script.js` e `edit-tournament/modal.js`; validado em produção.
- **Migration de paths legados** — `20260331_fix_formats_background_path.sql` executado; registros com `formats/` corrigidos no DB.
- **Cache de formato default no edit-tournament** — `tournamentFormatsLoaded = false` antes de `loadTournamentFormats()` no `modal.js`; testado e confirmado.

---

## Recent Wins (Mar 31, 2026)

**Session 5 (Mar 31):**
- **Deckbuilder layout** — grid 3 colunas → 2 colunas; chart de estatísticas deixou de ser comprimido pela coluna de meta pills. Meta pills com ícones SVG contextuais (deck/player/store/data/format) e separadores verticais no lugar de pills com fundo.
- **Filtro Set ao lado de Cost** — removido `filter-full` do input de Set; agora ocupa a segunda coluna do grid ao lado de Cost, onde o filtro de Trait ficava.
- **Post Generator backgrounds dinâmicos** — `DEFAULT_BACKGROUND_OPTIONS` hardcoded substituído por fetch dinâmico da tabela `formats` (`loadFormatBackgroundMap` retorna `options[]`). Inicialização async corrigida com `await` nos boot functions.
- **Admin formats** — botão Deactivate/Activate inline (sem abrir modal), delete detecta 0 linhas via `count=exact` e exibe mensagem sobre RLS, promoção automática de novo default quando o default é deletado, fix de `background_url`/`background_path` setados como `''` ao limpar (antes ficavam como `null` e o PATCH não incluía os campos).
- **Fix preview de imagem no admin** — `.admin-bg-fallback-label` de erro anterior persistia no DOM e aparecia como quadrado escuro ao lado da nova imagem; agora removido a cada chamada de `setFormatBgPreview`.
- **Format default no New Tournament modal** — `tournamentFormatsLoaded` resetado ao abrir o modal para garantir re-fetch e refletir o default atual do DB.
- **Legacy `formats/` bucket path** — normalização mantida na leitura (DB legado), removida na escrita (novos uploads e bucket browser usam root direto).
- **Admin formato default** — ao marcar novo default, `clearOtherDefaults()` faz PATCH em todos os outros antes de salvar o novo.

---

## Pending Immediate

- [x] Adicionar política RLS `DELETE` na tabela `formats` no Supabase dashboard ✅
- [x] Trocar endpoint OCR para `digimon-ocr-api.vercel.app` em todos os pontos de chamada ✅
- [x] Migration one-shot: limpar `formats/` nos `background_url`/`background_path` legados ✅
- [x] Revisar modal de edição de torneio (edit-tournament) para fix de cache de formato default ✅

---

## Suggested Milestones

1. **M1 (done):** Fix the three open bugs. Core flows unblocked. ✅
2. **M2 (done):** Statistics improvements (charts, SQL view, coverage indicator). CSS dark theme Wave 1. Admin Panel (format/meta CRUD, ban list). Mobile UX Wave 1. ✅
3. **M3 (done):** Players UX clarity ✅. Statistics sparkline ✅. Per-deck card filter ✅. Card preview in Top Cards ✅.
4. **M4 (done):** Store registration in Admin ✅. Deckbuilder drag-and-drop ✅. Light mode brightness pass ✅. Format backgrounds dinâmicos ✅. Admin formats inline actions ✅.
5. **M5 (next):** RLS fix, OCR endpoint, deckbuilder API search quality, player deck profile.
6. **M6 (future):** CSS modularização, i18n toggle, testes smoke, store attendance trends, consistency metric.

---

## Framework Migration

**React + Vite — Future consideration only, not now.**

The project works well in vanilla JS. A full migration would be costly with little immediate gain. Revisit only if the team grows or componentization becomes unmanageable. `styles.css` modularization (sem framework) seria o primeiro passo mais prático.

---

## Making it a Product (checklist — long term)

1. **Reliability & quality** — critical flow tests, consistent error handling, basic failure monitoring.
2. **Security & data governance** — RLS review completo por tabela, front/DB validation parity, backup + migration plan.
3. **Product & UX** — flawless core flows (onboarding, save, edit, export), consistent loading/error/success feedback, fewer active legacy paths.
4. **Technical scalability** — real componentization (even without a framework), modular and reusable code, clear domain separation (tournament / deck / player).
5. **Operations & release** — release checklist, versioning and release notes, basic usage metrics.
6. **Positioning** — clear end-user documentation, product narrative (what it solves, for whom), simple landing page and demo if possible.
