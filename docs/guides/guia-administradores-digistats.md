# Guia do Administrador — DigiStats

Versão 1.0 — 4 de agosto de 2026

Este guia apresenta as rotinas administrativas do DigiStats, com foco na integração DigiLab, cadastro de torneios, manutenção dos catálogos e resolução dos problemas mais comuns.

---

## 1. Acesso ao Admin

1. Abra o DigiStats e selecione **Admin** no menu lateral.
2. Digite sua senha individual.
3. Após o login, a seção **DigiLab** será aberta por padrão.

Use **Trocar senha** no topo da página para alterar sua credencial. Depois da troca, todas as sessões anteriores são encerradas e será necessário entrar novamente.

Use **Sair** ao terminar, especialmente em computadores compartilhados. Nunca compartilhe sua senha ou armazene credenciais em documentos, prints ou mensagens públicas.

## 2. Seções administrativas

O Admin possui cinco áreas:

- **DigiLab:** consulta, importação, vínculo e sincronização de torneios e decks.
- **Formatos / Meta:** cadastro dos formatos usados nos torneios e definição do formato padrão.
- **Lista de restrições:** manutenção de cartas banidas, limitadas ou sujeitas a regras especiais.
- **Lojas:** cadastro de lojas, logos e agenda semanal padrão.
- **Reparo de dados:** manutenção técnica dos metadados e do catálogo de cartas.

## 3. DigiLab

### 3.1 O que acontece automaticamente

O DigiStats consulta os torneios da scene Curitiba nos minutos 00, 15, 30 e 45 de cada hora, sem depender de navegador aberto ou de uma sessão administrativa.

Quando encontra um torneio novo, a rotina:

1. Carrega os dados do DigiLab.
2. Resolve loja, formato, jogadores e decks.
3. Cadastra jogadores identificados como realmente novos e sem conflito.
4. Refaz a validação após o cadastro dos jogadores.
5. Cria o torneio e seus resultados no mesmo ciclo quando tudo estiver resolvido.

A listagem do DigiLab também possui cache. Por isso, um torneio recém-publicado pode levar aproximadamente 15 a 30 minutos para aparecer no DigiStats.

No desktop, a barra lateral mostra uma contagem regressiva para a próxima busca. Ao chegar a zero, o indicador muda temporariamente para **Atualizando** e a lista de torneios é recarregada automaticamente após o processamento. O contador representa o horário da busca; ele não elimina o cache do próprio DigiLab.

### 3.2 Quando o jogador é cadastrado automaticamente

O cadastro é automático somente quando o jogador possui nome e identificador DigiLab válidos e não existe correspondência local ambígua.

O sistema não cria automaticamente o jogador quando encontra duplicidade de nome, possível correspondência com um cadastro existente, jogador anônimo ou qualquer informação insuficiente. Nesses casos, o torneio fica aguardando revisão.

Como a API DigiLab não fornece Bandai Member Number, jogadores criados por esse fluxo ficam inicialmente com `bandai_id` vazio.

### 3.3 Ações disponíveis

- **Testar conexão:** verifica a disponibilidade da integração. Use para diagnóstico, não como atualização rotineira.
- **Atualizar inventário:** recarrega a listagem e executa vínculos e importações que já estejam resolvidos.
- **Sincronizar dados pendentes:** percorre os itens da página atual, atualizando torneios vinculados e tentando criar torneios novos.
- **Executar automação agora:** executa imediatamente a mesma rotina agendada e antecipa a nova tentativa dos itens em revisão.
- **Consultar torneio:** permite buscar diretamente um torneio pelo ID DigiLab.
- **Detalhes:** abre standings, candidatos locais, correspondências de jogadores e decks, avisos e ações disponíveis.

O botão **Detalhes** funciona como alternador: clique novamente para fechar o mesmo item.

### 3.4 Criar no DigiStats

Para um torneio marcado como novo:

1. Abra **Detalhes**.
2. Confira data, loja, formato, quantidade de jogadores e classificação.
3. Revise os jogadores e decks sem correspondência.
4. Use **Criar no DigiStats**.

Se existirem jogadores inequivocamente novos, o próprio botão os cadastra primeiro, atualiza a prévia e cria o torneio em seguida. Não é necessário usar **Cadastrar jogadores** separadamente nesses casos.

### 3.5 Situações que exigem revisão

Um torneio não será criado automaticamente quando houver:

- loja sem correspondência;
- formato sem correspondência;
- deck sem correspondência;
- jogador anônimo, duplicado ou ambíguo;
- possível torneio local na mesma data;
- divergência relevante ou aviso na prévia;
- indisponibilidade temporária ou limite de requisições do DigiLab.

Abra **Detalhes**, revise os candidatos e selecione manualmente a correspondência correta. Nunca confirme um vínculo apenas porque as datas são iguais; confira também loja, jogadores e quantidade de participantes.

### 3.6 Torneios já vinculados

Use **Sincronizar dados** quando um torneio já existir no DigiStats, mas ainda precisar receber decks, pontuações ou outras informações do DigiLab. A operação atualiza o torneio vinculado sem criar uma cópia.

Quando o DigiLab possuir participantes ausentes no torneio local, a opção **Adicionar ausentes** pode reconciliar os resultados. Participantes locais excedentes não são excluídos automaticamente.

Ao excluir manualmente um torneio pela lista do DigiStats, seus resultados, vínculo DigiLab, arquivos OCR e estado da fila automática também são removidos. Atenção: se o torneio continuar publicado no DigiLab, a automação poderá encontrá-lo e cadastrá-lo novamente em um ciclo posterior.

### 3.7 Catálogo de decks DigiLab

Use **Abrir catálogo** para comparar arquétipos e famílias externas com os decks locais. Use **Atualizar do DigiLab** para buscar a versão mais recente do catálogo.

Correspondências exatas podem ser vinculadas automaticamente. Nomes divergentes devem ser revisados manualmente para evitar misturar arquétipos diferentes.

## 4. Importar um torneio pelo link DigiLab

Esse fluxo está disponível no cadastro normal e não exige acesso administrativo.

1. Abra **Novo torneio**.
2. Cole o link completo, por exemplo `https://digilab.cards/tournament/7187`, ou informe somente o ID.
3. Aguarde o preenchimento dos dados.
4. Revise loja, data, formato, jogadores, decks e pontos.
5. Faça os ajustes necessários e salve.

O link apenas preenche o formulário. O usuário continua responsável por revisar os dados antes do salvamento.

Depois de uma criação feita pelo Admin/DigiLab, a lista de torneios é atualizada automaticamente, sem necessidade de recarregar a página.

## 5. Importar prints da Bandai TCG+

1. Abra **Novo torneio**.
2. Clique em **Carregar print(s) e preencher** ou arraste os arquivos para a área de upload.
3. No desktop, vários prints podem ser selecionados ou arrastados juntos.
4. Aguarde o processamento de todas as imagens.
5. Revise jogadores, Bandai IDs, pontuações, loja e data.
6. Confirme os jogadores realmente novos e salve o torneio.

O DigiStats procura primeiro pelo Bandai ID e depois pelo nome. Jogadores inativos também são considerados. Se o jogador já existir sem Bandai ID e o print fornecer esse valor, o cadastro existente será atualizado e reativado em vez de duplicado.

Para melhores resultados, use imagens nítidas, sem cortes nos nomes, IDs ou pontuações. Sempre revise o formulário: o OCR é uma ajuda de preenchimento, não uma confirmação definitiva.

## 6. Formatos / Meta

Nesta seção é possível:

- criar e editar formatos;
- ativar ou inativar formatos;
- definir o formato padrão do cadastro de torneios;
- configurar a imagem de fundo usada pelo formato.

Antes de inativar ou renomear um formato, verifique se ele ainda é utilizado por torneios ou mapeamentos DigiLab.

## 7. Lista de restrições

Use esta seção para registrar regras aplicadas às novas decklists.

1. Pesquise pelo código ou nome da carta antes de criar uma regra.
2. Informe o tipo de restrição e as observações necessárias.
3. Revise o código da carta antes de salvar.

Alterações nessa lista valem para novas validações de decklist e não reescrevem automaticamente listas antigas.

## 8. Lojas

Nesta seção é possível criar, editar, ativar ou inativar lojas e gerenciar seus logos.

A **Agenda semanal padrão** sugere automaticamente uma loja conforme o dia da data escolhida no cadastro do torneio. A sugestão continua editável no formulário.

Evite criar variações do mesmo nome. Nomes consistentes melhoram a correspondência com OCR e DigiLab.

## 9. Reparo de dados

As ferramentas de reparo executam operações técnicas e devem ser usadas somente quando houver necessidade identificada:

- **Check:** verifica metadados incompletos.
- **Repair:** tenta preencher os registros encontrados pelo diagnóstico.
- **Download All Cards:** sincroniza o catálogo completo de cartas usado nas buscas.
- **Export Catalog:** gera e publica o arquivo consolidado do catálogo.

Não feche a página enquanto uma operação estiver em andamento. Se houver erro, registre a mensagem exibida antes de tentar novamente.

## 10. Solução de problemas

### “Não autorizado”

Saia e entre novamente. Se continuar, confirme que está usando sua senha administrativa individual e solicite ao responsável técnico a verificação da sua conta na lista de administradores.

### O torneio DigiLab ainda não apareceu

Aguarde até 30 minutos por causa do intervalo da automação e do cache externo. Para antecipar, use **Executar automação agora**. Se o item aparecer como revisão, abra **Detalhes**.

Se um torneio importado foi excluído manualmente, ele deixa de ser considerado importado. Enquanto continuar disponível no DigiLab, poderá reaparecer após uma nova execução automática.

### O torneio ficou em revisão

Confira a mensagem apresentada. Normalmente existe loja, formato, jogador, deck ou candidato local que precisa de decisão manual.

### Erro de jogador duplicado

Pesquise o jogador na tela **Jogadores**, incluindo os inativos. Não exclua um cadastro apenas para contornar o erro sem antes verificar seu histórico. Prefira atualizar ou reativar o registro correto.

### Limite temporário ou erro 429

Aguarde o tempo informado e tente novamente. Evite clicar repetidamente nas ações de atualização, pois todas consomem a mesma cota externa.

### OCR não reconheceu corretamente

Use prints mais nítidos, processe novamente e corrija manualmente os campos. Nunca salve sem revisar nomes, IDs e pontos.

## 11. Checklist rápido

Antes de criar ou vincular um torneio:

- confira data e loja;
- confira formato e quantidade de jogadores;
- valide nomes, decks, pontuações e colocações;
- verifique se já existe torneio local semelhante;
- resolva somente correspondências das quais tenha certeza;
- confirme que a lista foi atualizada após salvar.

Ao terminar:

- aguarde a conclusão de qualquer processamento;
- registre mensagens de erro relevantes;
- saia do Admin em dispositivos compartilhados.

## 12. Suporte

Ao reportar um problema, informe:

- ação executada;
- ID ou link do torneio DigiLab, quando aplicável;
- data e loja do torneio;
- mensagem de erro completa;
- print da tela sem senhas ou outros dados sensíveis.

Nunca envie chaves de API, tokens do Supabase ou credenciais administrativas.
