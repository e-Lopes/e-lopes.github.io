# Guia do Administrador — DigiStats

Versão 1.2 — 4 de agosto de 2026

Este guia apresenta as rotinas administrativas do DigiStats, com foco na integração com o DigiLab, cadastro de torneios, manutenção dos catálogos e solução dos problemas mais comuns.

---

## 1. Acesso ao Admin

1. Abra o DigiStats e selecione **Admin** no menu lateral.
2. Digite sua senha individual.
3. Após o login, a seção **DigiLab** será aberta por padrão.

Use **Trocar senha** no topo da página para alterar sua credencial. A nova senha deve ter entre 3 e 72 caracteres. Depois da troca, todas as sessões anteriores são encerradas e será necessário entrar novamente.

Use **Sair** ao terminar, especialmente em computadores compartilhados. Nunca compartilhe sua senha nem armazene credenciais em documentos, prints ou mensagens públicas.

## 2. Seções administrativas

O Admin possui cinco áreas principais:

- **DigiLab:** consulta, importação, vínculo e sincronização de torneios, jogadores e decks.
- **Formatos / Meta:** cadastro dos formatos usados nos torneios e definição do formato padrão.
- **Lista de restrições:** manutenção de cartas banidas, limitadas ou sujeitas a escolha restrita.
- **Lojas:** cadastro de lojas, logos, identificação e agenda semanal padrão.
- **Reparo de dados:** sincronização técnica dos metadados, catálogo de cartas e imagens de decks.

## 3. DigiLab

### 3.1 Qual sistema devo cadastrar primeiro?

Não é necessário cadastrar o torneio primeiro no DigiLab.

Para torneios locais, o cadastro rápido pode continuar sendo feito no DigiStats pelo celular, principalmente logo após o evento. Depois, o mesmo torneio deve ser cadastrado separadamente no DigiLab. A integração atual é somente de leitura e não envia nem cria torneios no DigiLab.

O caminho inverso é automatizado: se um torneio for publicado primeiro no DigiLab e ainda não existir no DigiStats, ele poderá ser identificado e criado pela automação. Também é possível antecipar o processo em **Admin > DigiLab**.

Regra prática: se o torneio já estiver no DigiLab, evite cadastrá-lo novamente de forma manual no DigiStats. Deixe a integração importar os dados ou vinculá-los ao torneio local correspondente.

### 3.2 O que acontece automaticamente

O DigiStats consulta os torneios da scene Curitiba nos minutos 00, 15, 30 e 45 de cada hora, sem depender de navegador aberto ou de uma sessão administrativa.

Quando encontra um torneio novo, a rotina:

1. Carrega os dados do DigiLab.
2. Resolve loja, formato, jogadores e decks.
3. Cadastra jogadores identificados como realmente novos e sem conflito.
4. Refaz a validação após o cadastro dos jogadores.
5. Cria o torneio e seus resultados no mesmo ciclo quando tudo estiver resolvido.

A listagem do DigiLab possui cache. Por isso, um torneio recém-publicado pode levar aproximadamente 15 a 30 minutos para aparecer no DigiStats.

No desktop, a barra lateral mostra uma contagem regressiva para a próxima busca. Ao chegar a zero, o indicador muda temporariamente para **Atualizando** e a lista de torneios é recarregada após o processamento. O contador representa o horário da busca; ele não elimina o cache do próprio DigiLab.

### 3.3 Quando o jogador é cadastrado automaticamente

O cadastro é automático somente quando o jogador possui nome e identificador DigiLab válidos e não existe correspondência local ambígua.

O sistema não cria automaticamente o jogador quando encontra duplicidade de nome, possível correspondência com cadastro existente, jogador anônimo ou informação insuficiente. Nesses casos, o torneio fica aguardando revisão.

Como a API DigiLab não fornece Bandai Member Number, jogadores criados por esse fluxo recebem inicialmente o mesmo nome nos campos de identificação por nome, enquanto o `bandai_id` permanece vazio.

### 3.4 Ações disponíveis

- **Testar conexão:** verifica a disponibilidade da integração. Use para diagnóstico, não como atualização rotineira.
- **Atualizar inventário:** recarrega a listagem e executa vínculos e importações que já estejam resolvidos.
- **Sincronizar dados pendentes:** percorre os itens da página atual, atualizando torneios vinculados e tentando criar torneios novos. O lote pode ser interrompido depois do item em andamento.
- **Executar automação agora:** executa imediatamente a mesma rotina agendada e antecipa uma nova tentativa dos itens em revisão.
- **Consultar torneio:** permite buscar diretamente um torneio pelo ID DigiLab.
- **Detalhes:** abre standings, candidatos locais, correspondências de jogadores e decks, avisos e ações disponíveis.

O botão **Detalhes** funciona como alternador: clique novamente para fechar o mesmo item.

### 3.5 Criar no DigiStats

Para um torneio marcado como novo:

1. Abra **Detalhes**.
2. Confira data, loja, formato, quantidade de jogadores e classificação.
3. Revise os jogadores e decks sem correspondência.
4. Use **Criar no DigiStats**.

Se existirem jogadores inequivocamente novos, o próprio botão os cadastra primeiro, atualiza a prévia e cria o torneio em seguida. Não é necessário usar **Cadastrar jogadores** separadamente nesses casos.

A criação é transacional: se uma etapa obrigatória falhar, o torneio e seus resultados não ficam gravados pela metade.

### 3.6 Situações que exigem revisão

Um torneio não será criado automaticamente quando houver:

- loja sem correspondência;
- formato sem correspondência para a criação;
- deck sem correspondência;
- jogador anônimo, duplicado ou ambíguo;
- possível torneio local conflitante na mesma data;
- quantidade ou lista de jogadores divergente;
- jogador marcado como DNF;
- aviso relevante na prévia;
- indisponibilidade temporária ou limite de requisições do DigiLab.

Abra **Detalhes**, revise os candidatos e selecione manualmente a correspondência correta. Nunca confirme um vínculo apenas porque as datas são iguais; confira também loja, jogadores e quantidade de participantes.

Uma diferença de formato entre um torneio DigiLab e um candidato local é exibida para conferência, mas é apenas informativa e não bloqueia o vínculo por si só.

### 3.7 Torneios já vinculados

Use **Sincronizar dados** quando um torneio já existir no DigiStats, mas ainda precisar receber decks, pontuações ou outras informações do DigiLab. A operação atualiza o torneio vinculado sem criar uma cópia.

Quando o DigiLab possuir participantes ausentes no torneio local, a opção **Adicionar ausentes** poderá reconciliar os resultados. Ela adiciona os ausentes e atualiza posição, deck e pontos dos participantes encontrados. Participantes locais excedentes não são excluídos automaticamente.

Ao excluir manualmente um torneio pela lista do DigiStats, seus resultados, vínculo DigiLab, arquivos de Print Bandai e estado da fila automática também são removidos. Se o torneio continuar publicado no DigiLab, a automação poderá encontrá-lo e cadastrá-lo novamente em um ciclo posterior.

### 3.8 Catálogo de decks DigiLab

Use **Abrir catálogo** para comparar arquétipos e famílias externas com os decks locais. Use **Atualizar do DigiLab** para buscar a versão mais recente do catálogo.

O catálogo diferencia família e arquétipo específico. Correspondências exatas e inequívocas podem ser vinculadas em lote. Nomes divergentes devem ser revisados manualmente para evitar misturar arquétipos diferentes.

## 4. Importar um torneio pelo link DigiLab

Esse fluxo está disponível no cadastro normal e não exige acesso administrativo.

1. Abra **Novo torneio**.
2. Cole o link completo, por exemplo `https://digilab.cards/tournament/7187`, ou informe somente o ID.
3. Aguarde o preenchimento dos dados.
4. Revise loja, data, formato, jogadores, decks e pontos.
5. Faça os ajustes necessários e salve.

O link somente preenche o formulário. O usuário continua responsável por revisar os dados antes do salvamento.

Depois de uma criação feita pelo Admin/DigiLab, a lista de torneios é atualizada automaticamente, sem necessidade de recarregar a página.

## 5. Importar prints da Bandai TCG+

1. Abra **Novo torneio**.
2. Clique em **Carregar print(s) e preencher** ou arraste os arquivos para a área de upload.
3. No desktop, vários prints podem ser selecionados ou arrastados juntos.
4. Aguarde o processamento de todas as imagens.
5. Revise jogadores, Bandai IDs, pontuações, loja e data.
6. Confirme os jogadores realmente novos e salve o torneio.

O DigiStats procura primeiro pelo Bandai ID e depois pelo nome. Jogadores inativos também são considerados. Se o jogador já existir sem Bandai ID e o print fornecer esse valor, o cadastro existente será atualizado e reativado em vez de duplicado.

Os prints processados com sucesso são arquivados e vinculados ao torneio como comprovantes. Novos prints adicionados durante uma edição complementam o histórico existente. Torneios cadastrados sem Print Bandai não recebem anexos.

Use imagens nítidas, sem cortes nos nomes, IDs ou pontuações. O processamento é uma ajuda de preenchimento, não uma confirmação definitiva. Nunca salve sem revisar o formulário.

## 6. Formatos / Meta

Nesta seção é possível:

- criar e editar formatos;
- ativar ou inativar formatos;
- definir o formato padrão do cadastro de torneios;
- configurar a imagem de fundo usada pelo formato.

Antes de inativar, excluir ou renomear um formato, verifique se ele ainda é utilizado por torneios ou mapeamentos DigiLab. O formato padrão não pode ser excluído antes que outro seja definido como padrão.

## 7. Lista de restrições

Use esta seção para registrar regras aplicadas às novas decklists.

1. Pesquise pelo código ou nome da carta antes de criar uma regra.
2. Selecione a restrição correta: banida, limitada ou escolha restrita.
3. Informe as observações necessárias.
4. Revise o código da carta antes de salvar.

Alterações nessa lista valem para novas validações de decklist e não reescrevem automaticamente listas antigas.

## 8. Lojas

Nesta seção é possível criar, editar, ativar ou inativar lojas, registrar o nome usado na Bandai e gerenciar seus logos.

A **Agenda semanal padrão** sugere automaticamente uma loja conforme o dia da data escolhida no cadastro do torneio. A sugestão continua editável no formulário.

Evite criar variações do mesmo nome. Nomes consistentes melhoram a correspondência com Print Bandai e DigiLab. Antes de excluir uma loja, confira se há torneios associados.

## 9. Reparo de dados

A área **Reparo de dados** apresenta a ação consolidada **Sync Cards**, executada pelo botão **Sync & Export**. Ela:

1. Busca a lista atual de cartas na API pública.
2. Identifica metadados ausentes ou incompletos.
3. Corrige tipos de carta quando os dados já estão disponíveis localmente.
4. Baixa e salva os metadados necessários.
5. Exporta o catálogo atualizado.
6. Sincroniza as imagens de decks para o Storage.

Essa rotina é técnica e deve ser executada manualmente somente quando houver uma necessidade identificada, como cartas novas ausentes, metadados incompletos ou imagens que precisam ser migradas. A sincronização completa também possui execução semanal automatizada.

Não feche a página enquanto a operação estiver em andamento. Acompanhe a barra de progresso e o log. Se houver erro, registre a mensagem exibida antes de tentar novamente.

## 10. Solução de problemas

### “Não autorizado”

Saia e entre novamente. Se continuar, confirme que está usando sua senha administrativa individual e solicite ao responsável técnico a verificação da sua conta na lista de administradores.

### O torneio DigiLab ainda não apareceu

Aguarde até 30 minutos por causa do intervalo da automação e do cache externo. Para antecipar, use **Executar automação agora**. Se o item aparecer como revisão, abra **Detalhes**.

Se um torneio importado foi excluído manualmente, ele deixa de ser considerado importado. Enquanto continuar disponível no DigiLab, poderá reaparecer após uma nova execução automática.

### O torneio ficou em revisão

Confira a mensagem apresentada. Normalmente existe loja, formato, jogador, deck ou candidato local que precisa de decisão manual. Resolva somente correspondências das quais tenha certeza.

### Erro de jogador duplicado

Pesquise o jogador na tela **Jogadores**, incluindo os inativos. Não exclua um cadastro apenas para contornar o erro sem antes verificar seu histórico. Prefira atualizar ou reativar o registro correto.

### Limite temporário ou erro 429

Aguarde o tempo informado e tente novamente. Evite clicar repetidamente nas ações de atualização, pois todas consomem a mesma cota externa. Em um lote, o limite real interrompe a sequência para proteger a integração.

### Print Bandai não foi reconhecido corretamente

Use prints mais nítidos, processe novamente e corrija manualmente os campos. Se o serviço estiver iniciando ou indisponível, aguarde e tente outra vez. Nunca salve sem revisar nomes, IDs e pontos.

### Sync & Export apresentou erro

Não reinicie repetidamente a rotina. Copie a última mensagem do log, registre em qual etapa ocorreu a falha e encaminhe essas informações ao suporte.

## 11. Checklist rápido

Antes de criar, importar ou vincular um torneio:

- confira data e loja;
- confira formato, tipo do torneio e quantidade de jogadores;
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

- a ação executada;
- o ID ou link do torneio DigiLab, quando aplicável;
- a data e a loja do torneio;
- a mensagem de erro completa;
- um print da tela sem senhas ou outros dados sensíveis.

Nunca envie chaves de API, tokens do Supabase ou credenciais administrativas.
