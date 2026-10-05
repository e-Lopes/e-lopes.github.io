# DigiStats — Roadmap e avaliação do projeto

Atualizado em **04/10/2026**, a partir do código local, migrations, documentação e checks. Referência: commit `1b60af7`.

## Pontuação atual: 8,5 / 10

O projeto evoluiu para uma ferramenta de operação do cenário local: torneios, OCR de múltiplos prints, decklists, estatísticas, posts, administração autenticada e sincronização DigiLab.

A nota avalia funcionalidade, confiabilidade, segurança, UX e manutenção; não é percentual de funcionalidades concluídas. A antiga nota de 8,8 não tinha cálculo reproduzível e convivia com notas baixas de infraestrutura e CSS. A diferença não indica regressão: esta revisão estabelece uma nova base comparável.

### Notas por área

As avaliações são qualitativas, de 0 a 10. A média ponderada é **8,45**, arredondada para **8,5**. Os pesos priorizam os fluxos centrais.

| Área | Nota | Peso | Evidências e limites |
| --- | ---: | ---: | --- |
| Torneios e OCR | 9,0 | 20% | CRUD, calendário, pontos, múltiplos prints e gravação transacional; falta cobertura dos fluxos completos no navegador. |
| Integração DigiLab | 9,0 | 15% | Prévia, importação, mapeamentos, fila, reconciliação e histórico; saúde do agendamento precisa de validação em produção. |
| Administração | 8,5 | 10% | Auth, allowlist, troca de senha, formatos, ban list, lojas, agenda e catálogo; revisar uniformidade de feedback das ações. |
| Deckbuilder e catálogo | 8,5 | 10% | Catálogo local com cache, filtros, importação, edição e previews; conjuntos novos e fallback externo exigem manutenção. |
| Estatísticas | 9,0 | 10% | Rankings, meta, cores, cartas, pilotos de decks e tendência de público por loja; faltam perfil agregado por deck de cada jogador e consistência temporal. |
| Jogadores e decks | 8,5 | 10% | Históricos com decklists, acesso ao builder, inativação e famílias de decks; aprofundar análise de desempenho por jogador. |
| Gerador de posts | 8,0 | 5% | Templates, backgrounds do banco, upload e exportação; melhorar atualização do cache e loading do seletor. |
| CSS e mobile | 6,5 | 10% | Extração parcial de estilos; global com 20.346 linhas e 1.329 ocorrências de `!important`; auditoria visual mobile pendente. |
| Infraestrutura, segurança e qualidade | 8,0 | 10% | 32 testes passando, lint no CI, migrations, PWA e funções server-side; faltam cobertura de navegador, auditoria completa de permissões e recuperação operacional demonstrada. |

### Limites da avaliação

- Revisão estática e testes/lint locais; sem auditoria visual em navegador ou consulta ao Supabase remoto.
- Migrations e workflows comprovam implementação versionada, sem confirmar aplicação e saúde em produção.
- Não foram medidas disponibilidade, latência ou taxas de sucesso de OCR, DigiLab e API de cartas.
- Notas são julgamento técnico baseado nas evidências disponíveis.

## Evolução desde março

- **DigiLab:** prévia pública por URL/ID, importação administrativa, cadastro de entidades ausentes, famílias/mapeamentos de decks, criação de formatos, sincronização agendada e histórico com nova tentativa.
- **Confiabilidade:** migration `20260924010000_reliable_digilab_sync.sql` e testes de reserva de execução, fila, recuperação de itens expirados, importação atômica e reconciliação preservando IDs e decklists.
- **Torneios:** gravação transacional de resultados e metadados OCR, pontos, múltiplos prints, agenda semanal e exclusão com limpeza da fila DigiLab.
- **Admin:** gestão de lojas com edição e upload de logo, autenticação Supabase, allowlist e troca de senha. Gestão de lojas deixou de ser uma pendência geral.
- **Cartas:** catálogo do Storage, matching local por texto e rotinas de atualização de metadados/imagens. A busca deixou de depender exclusivamente da API pública.
- **Estatísticas:** tendência de público por loja já implementada e métricas de pilotos por deck disponíveis. Ainda falta consolidar o desempenho dos decks de cada jogador.
- **Qualidade:** testes automatizados e lint/testes no CI; a afirmação antiga de “zero cobertura” foi removida.
- **Suporte:** guias de administradores, documentação por feature e feedback com função server-side.

## Backlog prioritário

### Evolução das estatísticas

Estatísticas com visão geral do cenário (meta, jogadores e lojas) permanecem no backlog. O ciclo atual prioriza consolidar as funcionalidades existentes, com evidências de confiabilidade, segurança e UX antes de ampliar o produto. O gerador de posts mantém exportação manual; integrações de publicação automática em redes sociais foram retiradas do escopo em 04/10/2026.

**Redesenhar estatísticas em torno de perguntas úteis:**

- Panorama do período: torneios, participantes únicos, participações, lojas e cobertura de decklists, com filtros coerentes de período, formato e loja.
- Metagame: popularidade dos decks separada de desempenho, evolução da participação e conversão em top4/títulos. Mostrar tamanho da amostra para contextualizar taxas elevadas com poucas participações.
- Jogadores: evolução e desempenho por deck, com critérios de ranking explícitos.
- Lojas: evolução de público e atividade, aproveitando a tendência já implementada.
- Cartas: frequência em decklists separada da quantidade de cópias, sempre com cobertura da amostra.
- Não apresentar taxa de vitória por partida ou confrontos sem dados de partidas. Pontos e colocação não substituem esses dados.
- Entrega inicial: definir métricas e filtros, produzir uma tela de visão geral e revisar antes de substituir as telas existentes.

### P1 — Segurança e confiabilidade

- [ ] Auditar permissões e RLS por operação/papel (`anon`, autenticado e admin), incluindo RPCs, Storage e Edge Functions. Escrita pública deve ser uma decisão explícita do produto. Entrega: matriz versionada e testes dos acessos permitidos/negados.
- [ ] Criar testes de navegador para criar/editar torneio, revisar OCR, salvar/reabrir decklist e importar/sincronizar DigiLab. Verificar persistência, erros e ausência de duplicação em reenvios.
- [ ] Validar operação remota DigiLab: migrations aplicadas, cron ativo, recuperação de falhas e pendências visíveis. Registrar execução real e falha recuperada sem duplicação.
- [x] Exibir duração das execuções DigiLab no histórico administrativo, junto ao início/fim e status existentes. Execuções em andamento mostram tempo decorrido no momento da consulta; timestamps ausentes/inválidos não geram métricas falsas.
- [ ] Registrar sucesso/falha, duração e última execução de OCR e evoluir indicadores/alertas de sincronização.

### P2 — Manutenção e UX

- [ ] Continuar extração de `styles.css` por página/componente e reduzir overrides. Mover uma área por vez, revisando temas e breakpoints sem duplicar regras.
- [ ] Auditar 375, 414, 480, 768 px e desktop nos dois temas: tabelas, modais, filtros, builder, Admin e posts. Garantir ações acessíveis, rolagem perceptível e conteúdo sem cortes.
- [x] Proteger salvamentos de formatos, ban list e lojas contra submissões simultâneas. Botões mostram “Salvando…”, formulários indicam `aria-busy` e ficam disponíveis para nova tentativa após falha.
- [ ] Estender a padronização de loading, erro e sucesso às demais ações administrativas e salvamentos.
- [x] Melhorar atualização do seletor de backgrounds: cache expira em 60 segundos, retorno à aba atualiza as opções quando expirado e falhas permitem nova consulta. Loading inicial e estado acessível de carregamento nos seletores.
- [ ] Validar busca/previews com conjuntos recentes, catálogo indisponível e falha da API. Distinguir ausência de resultados de erro e oferecer recuperação.

### P3 — Análise e produto

- [ ] Perfil do jogador por deck: participações, títulos, top4, pontos e evolução por período/formato.
- [ ] Consistência dos decks: sequência de top4 e eventos desde o último top4, com recorte e cobertura explícitos.
- [ ] Evoluir a tendência de público existente com comparações por período/loja e indicação de amostra.
- [x] Atualizar README e documentação OCR: referência ao roadmap, telas estatísticas existentes e endpoint utilizado pelo código.
- [ ] Atualizar snapshots do banco de março de forma controlada.
- [ ] Documentar release, backup e restauração, incluindo ensaio de recuperação. Scripts de snapshot existem; falta evidência operacional de recuperação.

## Marcos

| Marco | Estado | Critério de conclusão |
| --- | --- | --- |
| M1 — Torneios e decklists | Implementado; consolidar validação | Fluxos centrais com testes de navegador. |
| M2 — DigiLab e administração | Implementado; validar operação remota | Importação, fila e reconciliação em produção com recuperação demonstrada. |
| M3 — Segurança e confiabilidade | Próximo | Matriz de permissões, testes de autorização e indicadores operacionais. |
| M4 — CSS e mobile | Próximo | Extração por área e revisão visual nos tamanhos definidos. |
| M5 — Perfil e consistência | Futuro | Análise por jogador/deck e métricas temporais com cobertura clara. |
| M6 — Redesenho das estatísticas | Planejado: meta, jogadores e lojas | Visão geral revisada, filtros coerentes, métricas documentadas e amostras visíveis. |

## Validação desta revisão

- `npm run test`: **44 aprovados**, sem falhas ou skips. Cobrem validação, utilitários, exportação DigiLab, autorização administrativa, importação, fila, cache de backgrounds, submissões administrativas concorrentes/recuperação após falha, duração do histórico, disponibilidade do post de decklist do campeão e quantidades/percentuais do post de distribuição; parte executa SQL em PGlite.
- `npm run lint`: **0 erros e 0 warnings**.
- `.github/workflows/ci.yml`: lint e testes antes do job de deploy DigiLab.
- Fontes principais: `torneios/list-tournaments/script.js`, `torneios/decklist-builder/script.js`, `admin/script.js`, `players/script.js`, `decks/page.js`, `post-preview/script.js`, `tests/`, `database/migrations/` e `supabase/functions/`.

## Arquitetura e reavaliação

### Versão 2.0 — identidade Digital Hazard

Versão 2.0 em [demo-v2/](demo-v2/index.html), com escopo em [demo-v2/README.md](demo-v2/README.md). Usa o `Symbol_of_Digital_Hazard.svg` sem rotação, vermelho principal e posts em cinza chumbo. Visão geral organizada por formato: últimos torneios, decks em destaque e agenda das lojas. Metagame com participação, títulos/top 3 e resultados de jogadores, além dos relatórios consolidados. Cadastro manual de torneios, jogadores/decks, DigiLab e relatórios em páginas completas da v2, sem iframe. HTML/CSS adaptados, scripts de domínio compartilhados e estilos organizados em `shared/`. `npm run build:v2` gera as páginas a partir dos templates compartilhados. Exportação PNG preservada. Navegação, formulários e layouts conferidos no desktop e mobile; validação de gravações autorizadas e troca da entrada principal seguem descritas em [docs/architecture-v2.md](docs/architecture-v2.md).

Manter HTML/CSS/JavaScript vanilla neste ciclo. Extração de estilos, módulos menores e testes oferecem benefício imediato. Reavaliar React/Vite se a manutenção de componentes ou a equipe justificar o custo.

Recalcular a nota após cada marco com os mesmos pesos. Para chegar a 9+, priorizar segurança demonstrada, operação confiável, testes no navegador e manutenção sustentável de CSS/mobile.

### Consolidação em 04/10/2026

Publicação automática em redes sociais removida do escopo. Nesta rodada, o foco foi proteger salvamentos administrativos e tornar a duração DigiLab visível, mantendo o gerador manual. A nota permanece **8,5**: esses avanços têm testes locais, mas não concluem os marcos de auditoria de permissões, validação remota e cobertura de navegador necessários para uma reavaliação ampla.

Gerador manual: distribuição dedicada ao gráfico, nomes dos decks e legenda de quantidades/percentuais, sem classificação; imagens enquadradas por fatia. Top 4 com nomes ajustados à largura, acabamento mais limpo e colocação centrada na medalha. O tipo Decklist só aparece com lista válida do campeão. Prévia local do canvas de distribuição revisada no Edge com dados de exemplo; backgrounds e imagens remotas reais ainda precisam de revisão no fluxo completo.
