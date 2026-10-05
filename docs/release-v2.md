# Preparação da nova interface

A entrada `index.html` renderiza a nova interface diretamente na raiz, preservando os parâmetros e a rota. O endereço principal não recebe `/demo-v2/`. Os templates de `tools.html` e os endereços antigos em `demo-v2/` continuam disponíveis por compatibilidade. O build gera as duas entradas com os caminhos de assets e import maps correspondentes.

## Gerar a versão de produção

Execute `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` e `npm run build:release`.

O comando prepara o site completo em `.tmp/site/`. Publique o conteúdo dessa pasta, que inclui os arquivos estáticos, os diretórios **gerados** `demo-v2/app-shell/` e `demo-v2/mfe/`, o manifest dos módulos e `.nojekyll`. O pacote exclui banco de dados, scripts internos, dependências de desenvolvimento e arquivos ocultos de configuração.

Os diretórios gerados estão no `.gitignore`. O CI compila, verifica e publica o pacote completo no GitHub Pages após pushes na branch `main`. Pull requests executam as verificações sem publicar. O artefato `digimon-cwb-site` também fica disponível para consulta. Em Settings → Pages, a origem da publicação deve ser **GitHub Actions**.

Esta revisão identifica a interface como `2026.10.05.5` e o cache como `v90`. A alteração de cache permite que instalações existentes recebam os recursos novos.

## Experiência mobile

As verificações de navegador usam dados simulados e larguras de 320, 390 e 430 pixels para visão geral, torneios, decks, jogadores, metagame e posts. O menu e o suporte usam uma coluna; as tabelas extensas têm rolagem dentro do painel. O deckbuilder é exclusivo para computador e não inicializa o catálogo no mobile.

Antes de publicar, confira também um aparelho físico com login autorizado, teclado virtual e download de PNG. A emulação não substitui essas verificações.

## Identidade e README

`python scripts/export-brand.py --readme` gera `icons/digimon-cwb-banner-readme.png` com a assinatura centralizada, preservando o banner do X. O README apresenta o produto; os detalhes técnicos ficam em `docs/development.md`.

## Aplicativo salvo na tela inicial

O manifest mantém a URL `manifest.json`, o identificador `./` e a entrada `./index.html` da instalação original. O nome passa a ser **Digimon CWB**, e os ícones usam a nova marca em 192 e 512 pixels. As entradas principal e antiga também usam o ícone Apple de 180 pixels e o título novo. O service worker busca o manifest pela rede, com o cache como alternativa offline.

Em instalações Chrome/Android por WebAPK, o navegador pode atualizar nome e ícone depois de abrir o aplicativo; a atualização não é imediata. Atalhos simples e algumas plataformas podem exigir remover o atalho e adicioná-lo novamente. O site não pode forçar uma alteração no launcher do aparelho. Referências: [atualizações do manifest no Chrome](https://web.dev/articles/manifest-updates) e [atualização de PWAs](https://web.dev/learn/pwa/update).
