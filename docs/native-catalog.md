# Catálogo e torneios em React

As rotas `tournaments`, `manage`, `decks` e `players` usam listas nativas no
microfrontend Workspace. `manage` continua sendo um alias para preservar links
antigos e os retornos do deckbuilder. Admin e relatórios mantêm suas ferramentas
importadas, isoladas no elemento `#v2Tools`.

## Organização

- `frontend/shared/ListPage.tsx`: busca/filtros, paginação, menus de ações e diálogos.
- `frontend/apps/workspace/CatalogPages.tsx`: catálogo, jogadores, formulários e histórico.
- `frontend/apps/workspace/TournamentsPage.tsx`: lista, calendário, resultados e exportação DigiLab.
- `frontend/apps/workspace/catalog-service.ts`: acesso aos dados, validação e operações de cadastro.
- `frontend/apps/workspace/TournamentSteps.tsx`: etapas sobre os formulários existentes.
- `frontend/apps/workspace/catalog.css`: apresentação das telas nativas e das etapas.

Os formulários de torneio conservam a importação DigiLab/Bandai, autocompletar,
validações e salvamento existentes. O adaptador é inicializado apenas ao abrir
esses formulários ou as ferramentas administrativas. A montagem do HTML antigo
não participa da apresentação das listas novas.

Decks reutilizam as funções de upload/persistência dos módulos de criação e edição;
a nova interface não duplica essa rotina. Jogadores usam os mesmos endpoints e
campos do cadastro anterior. Inativar preserva o histórico.

Resultados antigos sem `tournament_id` só são associados por loja/data quando
existe exatamente um evento nessa combinação. Histórico carrega sob demanda,
e o retorno do deckbuilder conserva a identidade do jogador/deck.

## Validação

`npm run build`, `npm run typecheck` e `npm test` validam os módulos e os serviços.
`scripts/review-catalog.mjs` executa uma revisão opcional em navegador com dados
simulados, incluindo cadastro de jogador, histórico, calendário, etapas e layout
mobile. Requer servidor local na porta 4175 e Edge headless com depuração na porta
9228; não envia operações para a API real. As capturas são salvas na pasta temporária.

Os scripts de domínio recebem uma versão por sessão de página para evitar
combinar formulários React novos com scripts antigos em cache. `createPortal`
é fornecido pelo mesmo pacote compartilhado de React DOM usado para montar as telas.
