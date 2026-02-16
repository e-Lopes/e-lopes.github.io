# DigiStats Dashboard

Dashboard web para gestão de torneios de Digimon TCG, com frontend em HTML/CSS/JS e backend via Supabase.

## Objetivo

Centralizar operações de:

- cadastro e listagem de torneios
- gestão de jogadores
- gestão de decks
- visualizações de pódio e calendário

## Stack

- HTML, CSS e JavaScript (vanilla)
- Supabase (REST API/Postgres)
- Service Worker + Manifest (PWA)
- Node.js (lint, testes e automações)

## Estrutura do Projeto

- `index.html`: dashboard principal
- `script.js`: lógica principal da home
- `styles.css`: estilos globais consolidados
- `players/`: módulo de jogadores
- `decks/`: módulo de decks
- `torneios/`: fluxo principal de torneios (criar, listar, editar)
- `tournaments/`: rotas alias em inglês
- `config/`: configuração e utilitários compartilhados
- `database/`: documentação e snapshots SQL
- `tests/`: testes automatizados
- `post-preview/`: editor de posts e preview
- `legacy/`: area legada para compatibilidade

## Setup Local

### 1. Pré-requisitos

- Node.js 20+ (recomendado)
- npm
- Docker Desktop (necessário para `db:snapshot`)

### 2. Instalar dependências

```bash
npm install
```

### 3. Rodar checks de qualidade

```bash
npm run lint
npm run test
```

## Comandos Disponíveis

- `npm run lint`: valida JavaScript com ESLint
- `npm run test`: executa testes Node (`node --test`)
- `npm run format`: formata arquivos com Prettier
- `npm run db:snapshot`: exporta snapshot de schema/roles do Supabase

## Rastreio de Banco (Supabase)

Este projeto versiona estado de banco para auditoria e rollback.

### Configuração

Defina a URL de conexão:

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres:<password>@<host>:5432/postgres"
```

### Executar snapshot

```bash
npm run db:snapshot
```

Saídas esperadas:

- `database/snapshots/schema-YYYYMMDD-HHMMSS.sql`
- `database/snapshots/roles-YYYYMMDD-HHMMSS.sql`
- `database/schema.latest.sql`
- `database/roles.latest.sql`

Mais detalhes: `database/README.md`

## Fluxo de Trabalho no Git

### Branching sugerido

- `main`: estável
- `feat/<tema>`: novas features
- `fix/<tema>`: correções
- `chore/<tema>`: manutenção técnica

### Passos antes de commit

1. Rodar `npm run lint`
2. Rodar `npm run test`
3. Se houver mudança de banco, rodar `npm run db:snapshot`
4. Revisar `git diff`
5. Commit com mensagem clara

Exemplo de commit:

```bash
git commit -m "feat(players): improve pagination layout and cleanup styles comments"
```

## Padrões de Qualidade

- Evitar lógica duplicada entre páginas
- Reutilizar helpers de `config/`
- Manter nomenclatura consistente
- Evitar estilos inline em HTML
- Priorizar correções com impacto em UX e dados

## Documentação Complementar

- `TODO.md`: backlog atual
- `docs/structure-plan.md`: plano de organização
- `docs/naming-and-language.md`: convenções de nomenclatura/idioma
- `docs/security-rls.md`: segurança e RLS
- `docs/legacy-deprecation.md`: plano de depreciação de legado

## Observações de Segurança

- Não commitar segredos (`.env`, connection strings, chaves privadas)
- Rotacionar credenciais se forem expostas
- Revisar permissões e políticas no Supabase (RLS)
