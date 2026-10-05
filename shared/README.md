# Módulos compartilhados

As duas interfaces usam o mesmo Supabase e os mesmos fluxos de gravação. Esta pasta guarda código que não depende da página inicial escolhida.

- `data/tournaments.js`: leitura paginada e normalização de torneios, resultados, formatos, lojas e agenda; também fornece datas e validação de imagens.
- `data/admin-session.js`: sessão administrativa compatível com o Admin existente, verificação de acesso e gravação de lojas.
- `data/statistics.js`: agregação pura de participações, títulos e top 3, testável sem navegador ou banco.
- `workspace/native.js`: navegação das páginas completas, retorno do deckbuilder e raiz dos componentes dinâmicos. Não usa iframe ou comunicação entre janelas.
- `workspace/navigation.js`: submenus contextuais com abertura e fechamento independentes; seções com uma única opção não exibem expansão.
- `theme.css`: tokens de cores e superfícies usados pela interface e ferramentas da v2.
- `workspace/tools.css`: entrada dos estilos, com fundação em `base.css`, controles/tabelas/editores em `components.css` e cards mobile em `tournaments.css`.
- `workspace/native.css`: layout das ferramentas com menu da v2 e rolagem da página.
- `workspace/details.css`, `decks.css`, `players.css`, `admin.css` e `forms.css`: adaptação dos detalhes, catálogos, histórico, administração e cadastro para a identidade da v2.

Os templates compartilhados ficam em `tools.html` e no deckbuilder original. `npm run build:v2` gera `demo-v2/tools.html` e `demo-v2/deckbuilder.html` com o layout da v2. Os módulos de domínio continuam em `decks/`, `players/`, `admin/` e `torneios/`; seus scripts são compartilhados.

Consulte [a arquitetura e o caminho de substituição da interface](../docs/architecture-v2.md).
