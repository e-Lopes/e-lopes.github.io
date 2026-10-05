# DigiStats 2.0

Interface funcional com dados do mesmo Supabase usado pela aplicação principal. O caminho `demo-v2/` foi preservado para manter os links existentes; não há dados locais de exemplo ou indicadores fixos na interface.

## Abrir

Com Node.js 22.19 ou mais recente, execute `npm ci` e `npm run dev`; abra `http://127.0.0.1:5173/`. Para conferir a produção, execute `npm run build`, depois `python -m http.server 8765 --bind 127.0.0.1`, e acesse `http://127.0.0.1:8765/demo-v2/`. É necessário acesso ao Supabase para carregar os dados. Falhas de consulta são mostradas com opção de tentar novamente; nenhum resultado é inventado.

## Dados e funcionalidades

- `live-data.js` consulta `tournament`, `v_podium_full`, `stores`, `formats` e `tournament_weekly_schedule`. As consultas paginam de 500 em 500 registros, sem truncar o histórico no limite padrão da API.
- Resultados são associados pelo ID do torneio. Registros antigos sem ID só são associados por loja/data quando há um único torneio naquele dia, evitando mistura de eventos.
- Visão geral: últimos torneios primeiro, seguidos por decks em destaque e agenda das lojas. Todos os blocos usam o formato selecionado; o formato padrão cadastrado é a seleção inicial. Não há banner, cabeçalho promocional, cartões de indicadores nem filtro de período na página inicial.
- Torneios: busca, filtro de loja, ordenação e consulta aos resultados completos. Os cards mostram o top 3 com retratos, decks e jogadores; os resultados seguintes ficam em uma lista expansível. Torneios sem campeão cadastrado não oferecem post de pódio.
- Estatísticas / metagame: abas de participação, desempenho dos decks e resultados dos jogadores, com filtros de período, loja e formato. Mostra títulos, top 3 e participações; a conversão em títulos exclui participações em torneios sem campeão. Relatórios adicionais de cartas, ranking e lojas ficam na ferramenta de estatísticas. Entradas não representam pessoas únicas nem taxa de vitória por partida.
- Posts: eventos, campeões, formatos, datas, imagens e logos reais. Pódio com colocações ausentes identificadas como não registradas. Resumo por semana, em páginas de até cinco torneios, com totais da semana inteira e todos os formatos presentes.
- Exportação local de PNG 1080 × 1350. Imagens remotas usam CORS; uma imagem indisponível recebe substituto visual e aviso na prévia, preservando os nomes reais. Downloads ficam bloqueados quando não há dados ou a renderização falha.
- Admin: autenticação compatível com o Admin principal, catálogo de formatos, consulta a resultados e edição persistente de nomes de lojas. A gravação verifica sessão e participação em `admin_users`, usa o token do usuário e respeita as políticas RLS. Não usa chave de serviço.
- Decks e jogadores têm entradas próprias no menu, com cadastro, edição e histórico usando os módulos originais. Torneios oferece cadastro manual e gestão de resultados; Admin inclui DigiLab, sincronização, formatos, restrições, agenda e manutenção. As ferramentas e o deckbuilder abrem como páginas completas da v2, sem iframe, com menu e rolagem da página. Formulários, tabelas e componentes dinâmicos usam a identidade visual da v2.
- React, TypeScript e Vite compõem quatro micro-frontends: painel, operações, estúdio e deckbuilder. `tools.html` contém templates de formulários gerados como JSX; os controladores de operações permanecem compartilhados. Execute `npm run build` depois de alterar esses templates. Os aliases `tools.html` e `deckbuilder.html` encaminham para as rotas React. Detalhes em [docs/architecture-v2.md](../docs/architecture-v2.md).

## Identidade

Digital Hazard sem rotação, vermelho principal `#ef646b`, base escura e posts em cinza chumbo `#242629`. Destaques vermelho, azul, verde esmeralda `#4edb9b` e amarelo. Pódio dourado/prata/bronze; rodapé com identidade, localização e Instagram. Tipografia do sistema e CSS próprio, sem pacotes adicionais.

A escala visual usa variáveis CSS para textos de 12/14/16/18 px, títulos de seção de 22–24 px e títulos de página de 34–48 px. Retratos de destaque têm 64 px no desktop e 56 px no mobile; tabelas usam 56/48 px, e o top 3 dos cards usa 48 px. Logos preservam a proporção dentro de áreas de 88 × 52 px no desktop e 72–80 × 44–48 px no mobile. O zoom das cartas mantém a regra da página original de decks: 2,3× com origem em 20% da altura.

## Validação

Testes cobrem paginação, associação de resultados, semanas entre meses/anos, URLs de imagens e autorização de gravações. As chamadas de gravação nos testes são simuladas; os testes não alteram o banco remoto.

Consultas reais, filtros, resultados, bloqueio de edição sem login e PNG dos dois modelos foram verificados no navegador em 375, 414 e 1200 px. As ferramentas em páginas completas foram conferidas em 375 e 1440 px, com abertura dos formulários e sem transbordamento horizontal nas ferramentas; os layouts também foram inspecionados em 1440 px. Os 62 testes passaram; build, TypeScript e lint também foram aprovados. Login com uma conta real e gravação remota não foram executados durante a validação. Testes em aparelhos físicos e auditoria integral de acessibilidade permanecem pendentes.

A revisão de tipografia, retratos, logos, cards com top 3, resultados expansíveis e janelas de detalhes foi conferida em 375, 414, 768 e 1440 px, nas cinco áreas e três abas do Admin. A exportação dos dois modelos de post continuou funcionando.
