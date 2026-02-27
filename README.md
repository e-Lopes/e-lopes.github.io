# DigiStats Dashboard

Dashboard web para gestao de torneios de Digimon TCG, com frontend em HTML/CSS/JS e backend no Supabase.

## Objetivo

Centralizar operacoes de:

- cadastro e listagem de torneios
- gestao de jogadores
- gestao de decks
- visualizacoes de podio e calendario

## Stack

- HTML, CSS e JavaScript (vanilla)
- Supabase (Postgres + REST)
- Service Worker + Manifest (PWA)
- Node.js (lint, testes e automacoes)

## Estrutura do Projeto

- `index.html`: dashboard principal
- `torneios/list-tournaments/script.js`: logica principal da dashboard (tabela + calendario + modais)
- `styles.css`: estilos globais
- `styles/`: estilos por componentes e paginas
- `config/`: configuracoes e utilitarios compartilhados
- `players/`: modulo de jogadores
- `decks/`: modulo de decks
- `torneios/`: fluxo principal de torneios (criar, listar, editar, decklist)
- `tournaments/`: aliases em ingles (redirects) para rotas de `torneios/` (compatibilidade de URL)
- `post-preview/`: editor de post e preview
- `database/`: schema, migracoes e snapshots SQL
- `docs/`: guias de estrutura, nomenclatura e seguranca
- `tests/`: testes automatizados

## Rotas Ativas (Frontend)

- `/` -> `index.html` (carrega modulo de torneios com scripts de `torneios/list-tournaments/`)
- `/torneios/list-tournaments/` -> pagina de listagem/calendario de torneios
- `/torneios/create-tournament/` -> fluxo antigo de criacao (mantido por compatibilidade)
- `/players/` e `/decks/` -> modulos dedicados
- `/post-preview/` -> editor/preview de posts
- `/tournaments/*` -> redirects para `/torneios/*`

## OCR (Bandai TCG+)

- O modal `New Tournament` suporta importacao de print(s) para OCR.
- Endpoint esperado no momento: `POST https://e-lopes-digimon-ocr-api.hf.space/process` com `multipart/form-data` (`file`).
- Retorno utilizado pelo frontend:
  - `players[]` para autopreencher resultados
  - `store_name` para tentar match de loja no select
  - `tournament_date` (ou `tournament_datetime`) para preencher a data do torneio

## Setup Local

### 1. Pre-requisitos

- Node.js 20+
- npm
- Docker Desktop (necessario para `db:snapshot`)

### 2. Instalar dependencias

```bash
npm install
```

### 3. Rodar checks de qualidade

```bash
npm run lint
npm run test
```

## Scripts

- `npm run lint`: valida JavaScript com ESLint
- `npm run test`: executa testes Node (`node --test`)
- `npm run format`: formata arquivos com Prettier
- `npm run db:snapshot`: exporta snapshot de schema/roles do Supabase

## Banco de Dados (Supabase)

Defina a conexao antes de gerar snapshots:

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres:<password>@<host>:5432/postgres"
```

Execute:

```bash
npm run db:snapshot
```

Saidas esperadas:

- `database/snapshots/schema-YYYYMMDD-HHMMSS.sql`
- `database/snapshots/roles-YYYYMMDD-HHMMSS.sql`
- `database/schema.latest.sql`
- `database/roles.latest.sql`

Detalhes adicionais em `database/README.md`.

## Estado Atual do Frontend

Backlog imediato em `TODO.md`:

- criar telas para as views:
- `v_deck_representation`
- `v_deck_stats`
- `v_meta_by_month`
- `v_montly_ranking`
- `v_player_ranking`
- `v_store_champions`

## Fluxo de Trabalho

1. Rodar `npm run lint`
2. Rodar `npm run test`
3. Se houver mudanca de banco, rodar `npm run db:snapshot`
4. Revisar `git diff`
5. Commit com mensagem clara

Exemplo:

```bash
git commit -m "feat(players): improve pagination layout"
```

## Documentacao Complementar

- `TODO.md`
- `docs/codebase-audit-2026-02-27.md`
- `docs/structure-plan.md`
- `docs/naming-and-language.md`
- `docs/security-rls.md`
- `post-preview/README.md`

## Seguranca

- nao commitar segredos (`.env`, connection strings, chaves privadas)
- rotacionar credenciais se forem expostas
- revisar permissoes e politicas de RLS no Supabase
