# Proposta de Metagame e Estatísticas

Consulta somente de leitura em 05/10/2026. Não altera rankings nem registros.

## Base atual

- 210 torneios, entre 14/12/2023 e 02/10/2026.
- 2.044 participações e 2.044 resultados; todos os torneios têm contagem de resultados igual ao total declarado. Isso verifica quantidade, não unicidade de posições ou validade individual.
- Nenhum resultado sem vínculo com torneio.
- 52 resultados sem deck; distinguir eventos sem deck dos registros incompletos antes de calcular participação.
- 2.009 resultados com pontos de partida preenchidos. Pontos agregados não permitem reconstruir confrontos ou taxa de vitória por partida.
- 93 decklists estruturadas; não equivalem necessariamente a 93 listas completas ou a 93 resultados distintos.
- BT26: 18 torneios, 128 participações, 34 jogadores e 42 decks identificados.
- EX12: 92 torneios e 949 participações; juntar todos os formatos distorce a leitura atual.
- Nomes históricos de eventos precisam de normalização para filtros, preservando o registro original.

## Organização proposta

Uma única entrada **Metagame e estatísticas**, substituindo a separação entre análise nova e relatórios antigos. Abas:

1. **Metagame**: decks mais utilizados, desempenho e evolução.
2. **Comunidade**: atividade, jogadores e lojas.
3. **Decklists**: listas registradas e cartas utilizadas nessa amostra.

O formato atual tem prioridade absoluta, mas só aparece como opção quando tem pelo menos um torneio cadastrado. O seletor de formatos permanece sempre visível, incluindo os formatos antigos com registros. Se o formato padrão configurado ainda não tiver eventos, abrir o formato mais recente com dados. Não misturar formatos no padrão da página.

Período padrão: todos os eventos do formato atual. A divisão temporal principal é mensal: atalhos **Todo o formato**, **Este mês**, meses anteriores do mesmo formato e intervalo personalizado. Semana fica apenas como opção complementar nos filtros avançados, sem destaque nem comparações automáticas na primeira tela. Loja e tipo de evento são filtros secundários. Não comparar meses de formatos diferentes como se representassem o mesmo metagame.

## Metagame

Resumo compacto: torneios, participações com deck identificado, jogadores únicos e decks únicos. Exibir separadamente cobertura dos decks e intervalo efetivamente analisado.

Tabela principal com imagem e nome do deck, participações, participação percentual, jogadores distintos, títulos e Top 4. Ordenação inicial por participações; alternar para títulos ou conversão. Mostrar numerador e denominador junto às taxas. Filtro de amostra mínima opcional, com controle visível; não esconder decks por padrão.

Popularidade = participações do deck / participações com deck conhecido no recorte. Contar uma entrada por jogador por torneio, validando duplicatas antes de agregar. Agrupar por IDs, não por nomes. Eventos sem deck ficam fora das métricas de decks.

Conversão em título = títulos / participações elegíveis. Top 4 = chegadas às posições 1–4 / participações elegíveis. Para análise comparável de Top 4, padrão somente eventos com pelo menos oito participantes; explicar e permitir alterar. Competições menores continuam no volume e títulos. Resultados incompletos não entram em taxas de desempenho; aparecem no indicador de cobertura.

Detalhe do deck: evolução mensal, jogadores que utilizaram, resultados recentes e decklists disponíveis. Gráfico de barras horizontal para popularidade; linha temporal apenas quando houver vários meses. Comparação temporal mantém mesmo formato, loja e tipo e usa intervalos equivalentes; mês em andamento compara até o mesmo dia do mês anterior e informa a amostra. Mostrar variação em pontos percentuais. Ausência de período anterior aparece como indisponível. Com apenas um mês de dados, omitir o gráfico temporal e priorizar a tabela.

## Comunidade

Participações e jogadores únicos são métricas distintas. Mostrar eventos por semana, média de participantes, jogadores por loja e atividade recente. Jogadores: participações, títulos, Top 4 e último evento; detalhes no perfil existente. Empates permanecem visíveis. Rankings de pontos existentes podem permanecer como opção com fórmula acessível, sem misturar pontos de classificação e pontos de partidas.

## Decklists

Busca por deck, torneio e jogador. Cada lista leva ao editor/detalhe existente. Cartas mais usadas somente entre listas válidas disponíveis, com quantidade de listas no denominador. Não extrapolar essa amostra para todo o metagame. Cores derivadas do cadastro do deck devem ser descritas como cores do arquétipo; composições reais exigem listas.

## Interface e limites

- Mesmo tema, seletores, menus e paginação das páginas novas.
- Uma tabela principal; evitar repetição de pódios, rankings e cards com os mesmos dados.
- Explicações curtas nas métricas e metodologia acessível.
- Remover score opaco e classificação de concentração da primeira tela. Se mantidos em análise avançada, definir fórmula e base.
- Não apresentar matchups, win rate por partida ou vantagem entre decks: faltam confrontos individuais.
- Sem nova coleta obrigatória; aproveitar registros e rotinas atuais.

## Etapas de implementação

1. Serviço único de análise por IDs, normalização dos eventos, cobertura e testes de agregação.
2. Página Metagame com filtros, tabela, detalhe e evolução.
3. Comunidade e Decklists; migrar recursos úteis dos relatórios antigos.
4. Redirecionar a navegação antiga para a nova página após validar equivalência dos totais, empates, eventos pequenos e registros sem deck.

Critérios: totais conciliados com os registros, nenhum percentual sem base, estados vazios claros, uso mobile sem corte horizontal da página e preservação dos links de torneios, decks, jogadores e listas.

## Implementação entregue

Página React com seletor de formato sempre visível, filtros mensais/loja/tipo, abas Metagame/Comunidade/Decklists, tabelas paginadas, detalhe do deck com evolução mensal e resultados recentes. IDs identificam decks e jogadores nas agregações. Metodologia e cobertura visíveis. O caminho antigo `statistics` abre a nova página Metagame; a entrada duplicada de relatórios saiu do menu. Rotinas de dados e cadastro existentes preservadas.

Taxas de títulos e Top 4 usam classificações completas e validam posições e duplicatas. Release Events e Pre-Release ficam fora da análise de decks. Barras usam percentuais numéricos CSS, sem separador decimal localizado. Cabeçalhos permitem ordenar popularidade, títulos e conversão. Taxas de Top 4 com menos de cinco participações elegíveis indicam amostra pequena.

Validação: testes do modelo de análise, TypeScript, compilação e revisão no navegador desktop/mobile com dados simulados. Análise de cartas e rankings antigos por pontuação não foram transportados para a interface principal; a aba Decklists oferece acesso às listas existentes.
