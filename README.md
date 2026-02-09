# Dashboard de Torneios - Digimon TCG

Este é um dashboard web responsivo para exibir resultados de torneios do Digimon TCG, conectado ao Google Sheets.

## 🚀 Como Configurar

### Passo 1: Preparar o Google Sheets

1. **Abra seu Google Sheets** com os dados dos torneios
2. **Publique o Google Sheets na web:**
   - Clique em `Arquivo` → `Compartilhar` → `Publicar na web`
   - Selecione "Documento inteiro" ou as abas específicas
   - Clique em "Publicar"
   - Mantenha a janela aberta para copiar o ID

3. **Copie o ID da planilha:**
   - Na URL do Google Sheets: `https://docs.google.com/spreadsheets/d/1ABC123XYZ/edit`
   - O ID é: `1ABC123XYZ`

### Passo 2: Configurar o Código

1. **Abra o arquivo `script.js`**
2. **Na linha 4**, substitua `SEU_SHEET_ID_AQUI` pelo ID da sua planilha:

```javascript
const SHEET_ID = '1ABC123XYZ'; // Seu ID aqui
```

### Passo 3: Verificar as Abas do Google Sheets

Certifique-se de que suas abas estão nomeadas corretamente:

#### Aba 1: "Respostas ao formulário 1"
Colunas:
- Carimbo de data/hora
- Endereço de e-mail
- 1) Store Name
- 2) Tournament Date
- 3) Number of Players
- 4) Final Placement
- 5) Deck
- [Optional] Link to decklist
- [Optional] Additional Notes

#### Aba 2: "Base_Imagens"
Colunas:
- Nome_Deck
- Imagem

Exemplo:
```
Sakuyamon    https://deckbuilder.egmanevents.com//card_images/digimon/ST22-05.webp
BlueFlare    https://deckbuilder.egmanevents.com//card_images/digimon/BT11-031.webp
Hudiemon     https://deckbuilder.egmanevents.com//card_images/digimon/BT23-101.webp
```

## 📤 Como Publicar Gratuitamente (GitHub Pages)

### Opção 1: Usando GitHub Desktop (Mais Fácil)

1. **Baixe e instale o GitHub Desktop:**
   - https://desktop.github.com/

2. **Crie uma conta no GitHub:**
   - https://github.com/signup

3. **Crie um novo repositório:**
   - No GitHub Desktop, clique em `File` → `New Repository`
   - Nome: `digimon-tournament-dashboard`
   - Marque "Initialize this repository with a README"
   - Clique em "Create Repository"

4. **Adicione os arquivos:**
   - Copie os 3 arquivos para a pasta do repositório:
     - `index.html`
     - `styles.css`
     - `script.js`
   - No GitHub Desktop, você verá as mudanças
   - Adicione uma mensagem: "Initial commit"
   - Clique em "Commit to main"
   - Clique em "Publish repository"

5. **Ative o GitHub Pages:**
   - Vá para o repositório no GitHub.com
   - Clique em `Settings`
   - No menu lateral, clique em `Pages`
   - Em "Source", selecione `main` branch
   - Clique em "Save"
   - Aguarde alguns minutos

6. **Acesse seu site:**
   - URL: `https://seu-usuario.github.io/digimon-tournament-dashboard`

### Opção 2: Upload Direto no GitHub.com

1. **Crie uma conta no GitHub:**
   - https://github.com/signup

2. **Crie um novo repositório:**
   - Clique no botão `+` no canto superior direito
   - Selecione "New repository"
   - Nome: `digimon-tournament-dashboard`
   - Marque "Public"
   - Clique em "Create repository"

3. **Faça upload dos arquivos:**
   - Na página do repositório, clique em "uploading an existing file"
   - Arraste os 3 arquivos (`index.html`, `styles.css`, `script.js`)
   - Clique em "Commit changes"

4. **Ative o GitHub Pages:**
   - Vá em `Settings` → `Pages`
   - Em "Source", selecione `main` branch
   - Clique em "Save"

5. **Acesse seu site:**
   - URL: `https://seu-usuario.github.io/digimon-tournament-dashboard`

## 🎨 Personalização

### Adicionar Novos Decks

1. No `script.js`, adicione a cor do deck no objeto `deckColors`:

```javascript
const deckColors = {
    'Mastemon': 'yellow',
    'Jesmon': 'red',
    'Hudiemon': 'orange',
    'Beelzemon': 'purple',
    'Sakuyamon': 'green',
    'BlueFlare': 'blue',
    'SeuNovoDeck': 'red' // Adicione aqui
};
```

### Cores Disponíveis:
- `yellow` (amarelo)
- `red` (vermelho)
- `orange` (laranja)
- `blue` (azul)
- `green` (verde)
- `purple` (roxo)

## 🆓 Outras Opções de Hospedagem Gratuita

### Netlify (Alternativa ao GitHub Pages)

1. **Acesse:** https://www.netlify.com/
2. **Crie uma conta gratuita**
3. **Arraste a pasta com os arquivos** na interface do Netlify
4. **Pronto!** Seu site estará no ar

### Vercel (Outra Alternativa)

1. **Acesse:** https://vercel.com/
2. **Crie uma conta gratuita**
3. **Importe seu projeto do GitHub** ou faça upload
4. **Deploy automático**

## 📱 Funcionalidades

✅ **Responsivo** - Funciona em celular, tablet e desktop
✅ **Filtros** - Por loja e data
✅ **Conexão em tempo real** - Atualiza conforme o Google Sheets
✅ **Top 6** - Mostra os 6 primeiros colocados com imagens
✅ **Links** - Clique nos cards para ver decklists
✅ **Totalmente gratuito** - Sem custos de hospedagem

## 🔧 Solução de Problemas

### Os dados não aparecem?

1. Verifique se o Google Sheets está publicado na web
2. Confirme se o SHEET_ID está correto no script.js
3. Verifique se os nomes das abas estão exatamente como:
   - "Respostas ao formulário 1"
   - "Base_Imagens"

### As imagens não carregam?

1. Verifique se as URLs das imagens estão corretas
2. Certifique-se de que as URLs começam com `https://`
3. Teste as URLs diretamente no navegador

### O site não aparece no GitHub Pages?

1. Aguarde 5-10 minutos após ativar o GitHub Pages
2. Verifique se o repositório é público
3. Limpe o cache do navegador (Ctrl+F5)

## 📞 Suporte

Se tiver problemas, verifique:
1. Console do navegador (F12) para ver erros
2. Se o Google Sheets está acessível publicamente
3. Se todas as colunas estão preenchidas corretamente

## 📄 Licença

Livre para usar e modificar! 🎮