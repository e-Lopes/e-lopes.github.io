![Logo do Projeto](icons/logo.png)

A responsive web dashboard for displaying Digimon TCG tournament results, powered by Supabase (https://supabase.com/).

## Database

The project uses Supabase (PostgreSQL).

Main tables:
- decks
- deck_images
- stores
- tournament_results

Analytics views:
- v_deck_representation
- v_meta_by_month

The database schema is documented in /database/schema.sql

// TODO supabase.from('v_deck_representation').select('*')


## 🌟 Features:
✅ Real-time Database - Powered by Supabase PostgreSQL

✅ Responsive Design - Mobile, tablet, and desktop friendly

✅ Tournament Management - Create, view, and analyze tournament results

✅ Deck Library - Manage Digimon decks with card images

✅ Interactive Podium - Visual top 3 display with deck images

✅ Live Filtering - Filter by store and tournament date

✅ Decklist Links - Direct links to external decklists

✅ Free Hosting - Deployable via GitHub Pages, Netlify, or Vercel

## 💻 Known Bugs & Future Improvements:

[BUG] Editar um Registro de torneio que ja aconteceu e salvar faz criar um novo registro para cada deck no banco de dados

[Feature]Add cadastro de loja

[Feature]Add Label de Loja e dia em cima do podium

[UI] Criar uma visualização diferente dos decks para a quando estiver em mobile

[UI] Talvez deixar paginado a pagina de decks

[UI] Verificar posicionamento dos botoes de voltar pagina e voltar para o dashboard para ficar consistente e bem posicionado (botao de voltar ser em cima e não em baixo, por causa do mobile)

[UI] Repensar a visualização dos deck no web para ficar sem o link da imagem no card e ser algo que ocupa menos espaço

[UI+PossívelFeature] No cadastro de resultado de torneio, ao inves de ser uma seleção, fazer com que de para escrever o nome, e tenha uma sugestão de autocomplete baseado no nome que ja tem cadastrado, Se o deck que a pessoa digitou ainda não existe (tem que fazer um tratamento de upper/lower) tem que fazer um jeito dela escolher a arte do deck
