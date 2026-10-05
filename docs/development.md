# Desenvolvimento do DIGIMON CWB

Dashboard web para gestão de torneios de Digimon TCG. A versão 2 usa React, TypeScript e micro-frontends com backend no Supabase; os controladores de operações existentes permanecem compartilhados.

## Objetivo

Centralizar operacoes de:

- cadastro e listagem de torneios
- gestao de jogadores
- gestao de decks
- visualizacoes de podio e calendario

## Stack

- React, TypeScript e Vite na v2; módulos JavaScript consolidados nas operações
- Micro-frontends ESM com build independente e composição no navegador
- Supabase (Postgres + REST)
- Service Worker + Manifest (PWA)
- Node.js (lint, testes e automacoes)

## Estrutura do Projeto

- `index.html`: entrada compatível da dashboard original; preserva parâmetros ao abrir `demo-v2/`
- `tools.html`: shell compartilhado de torneios, jogadores, decks, estatísticas e Admin
- `demo-v2/`: interface 2.0, com navegação própria e ferramentas em páginas completas
- `frontend/`: shell React, contratos e quatro micro-frontends
- `shared/`: dados, sessão, estatísticas e adaptação das ferramentas para a v2
- `torneios/list-tournaments/script.js`: logica principal da dashboard (tabela + calendario + modais)
- `styles.css`: estilos globais
- `styles/`: estilos por componentes e paginas
- `config/`: configuracoes e utilitarios compartilhados
- `players/`: modulo de jogadores
- `decks/`: modulo de decks
- `torneios/`: fluxo principal de torneios (criar, listar, editar, decklist)
- `post-preview/`: editor de post e preview
- `database/`: schema, migracoes e snapshots SQL
- `supabase/functions/`: Edge Functions e integracoes server-side
- `docs/`: guias de estrutura, nomenclatura e seguranca
- `tests/`: testes automatizados

## Rotas Ativas (Frontend)

- `/` -> `index.html` -> `demo-v2/` (nova interface, com parâmetros preservados)
- `/demo-v2/` -> interface 2.0 com as ferramentas compartilhadas
- `/torneios/list-tournaments/` -> pagina de listagem/calendario de torneios
- `/torneios/create-tournament/` -> fluxo antigo de criacao (mantido por compatibilidade)
- `/players/` e `/decks/` -> modulos dedicados
- `/post-preview/` -> editor/preview de posts

## OCR (Bandai TCG+)

- O modal **Novo torneio** aceita um ou mais prints da Bandai TCG+ para OCR.
- No desktop, vários arquivos podem ser selecionados ou arrastados juntos para **Carregar print(s) e preencher**.
- Os resultados de cada imagem são combinados no formulário para revisão antes do salvamento.
- Jogadores existentes, inclusive inativos ou ainda sem `bandai_id`, são reutilizados; quando o print fornece o Bandai ID ausente, o cadastro local é atualizado em vez de duplicado.
- Endpoint atual: `POST https://digimon-ocr-api.vercel.app/process` com `multipart/form-data` (`file`).
- Retorno utilizado pelo frontend:
    - `players[]` para autopreencher resultados
    - `store_name` para tentar match de loja no select
    - `tournament_date` (ou `tournament_datetime`) para preencher a data do torneio

## Setup Local

### 1. Pre-requisitos

- Node.js 22.19 ou mais recente
- npm
- Docker Desktop (necessario para `db:snapshot`)

### 2. Instalar dependencias

```bash
npm install
```

Para desenvolver a v2, execute `npm run dev` e abra `http://127.0.0.1:5173/`. O comando prepara os módulos e inicia o Vite. Use `npm run build` para gerar a versão de produção antes de servir ou publicar os arquivos estáticos. A organização dos módulos e os comandos individuais estão em [docs/architecture-v2.md](architecture-v2.md).

### 3. Rodar checks de qualidade

```bash
npm run lint
npm run test
```

## Scripts

- `npm run lint`: valida JavaScript com ESLint
- `npm run typecheck`: valida os contratos e componentes TypeScript
- `npm run build`: compila shell, dependências compartilhadas e micro-frontends da v2
- `npm run test`: executa testes Node (`node --test`)
- `npm run format`: formata arquivos com Prettier
- `npm run db:snapshot`: exporta snapshot de schema/roles do Supabase
- `node scripts/generate-admin-guide-pdf.js`: atualiza o HTML e o PDF distribuível do guia de administradores a partir do Markdown

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

## Integração DigiLab

- O frontend gera standings para publicação manual no DigiLab.
- Qualquer usuário pode colar a URL completa ou o ID de um torneio DigiLab no modal **Novo torneio** para carregar loja, data, formato, jogadores, decks e pontos antes de salvar.
- A chave da API fica em `DIGILAB_API_KEY`, nos secrets das Edge Functions.
- `digilab-health` valida secret e conectividade sem expor credenciais ou dados de torneios.
- A aba **Admin → DigiLab**, aberta por padrão no Admin, usa Supabase Auth, lista e pré-visualiza torneios de Curitiba, confirma vínculos em `tournament_digilab_sync` e cria ou sincroniza torneios pela função `import-digilab-tournament`.
- A rotina `sync-new-digilab-tournaments` é executada a cada 15 minutos: percorre o histórico gradualmente, revisa torneios recentes e cadastra jogadores/decks ausentes na mesma transação do torneio. O Admin mostra o histórico das execuções e permite tentar novamente uma pendência. Casos ambíguos ficam para revisão.
- No desktop, a barra lateral mostra a contagem regressiva para a próxima busca DigiLab. Após o ciclo, a lista de torneios é recarregada automaticamente.
- A allowlist administrativa fica em `admin_users`; secrets nunca são enviados ao navegador.

Configuração, operação e estado da implementação: `docs/features/digilab-integration.md`.

## Estado Atual do Frontend

A versão 2.0 está em [demo-v2/](../demo-v2/index.html): identidade Digital Hazard, painéis com consultas reais ao Supabase e posts de pódio/resumo semanal com fundo cinza chumbo. Inclui gestão de jogadores e decks, cadastro manual de torneios, DigiLab e estatísticas, usando os módulos consolidados dentro da navegação v2. Instruções em [demo-v2/README.md](../demo-v2/README.md) e organização para a futura substituição da interface em [docs/architecture-v2.md](architecture-v2.md).

As telas de estatísticas de decks, metagame, jogadores, cartas, cores e lojas já estão implementadas. Consulte [docs/statistics.md](statistics.md) para métricas e telas disponíveis.

Prioridades e pendências estão em [roadmap.md](../roadmap.md), com foco na confiabilidade, segurança e UX das funcionalidades existentes. O gerador de posts mantém exportação e publicação manual.

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

- `roadmap.md`
- `docs/codebase-audit-2026-02-27.md`
- `docs/structure-plan.md`
- `docs/naming-and-language.md`
- `docs/security-rls.md`
- `docs/features/digilab-integration.md`
- `docs/features/ocr-import.md`
- `docs/guides/guia-administradores-digistats.md`
- `post-preview/README.md`

## Seguranca

- nao commitar segredos (`.env`, connection strings, chaves privadas)
- rotacionar credenciais se forem expostas
- revisar permissoes e politicas de RLS no Supabase
