# Integração entre DigiStats e DigiLab

## Contexto

Os torneios locais são cadastrados no DigiStats e posteriormente publicados no DigiLab. O objetivo da integração é reduzir o retrabalho sem depender de automação de navegador, endpoints internos ou credenciais expostas no frontend.

O DigiLab aceita standings enviados por CSV, PDF ou prints da Bandai TCG+. A API pública disponível atualmente é somente leitura. A primeira versão usa o formato de texto aceito na entrada manual, antes de qualquer automação adicional.

## Dados locais utilizados

### Torneio

- ID, nome, data, loja, formato, quantidade de jogadores e rodadas.
- Resultados ordenados por colocação.
- Pontos de cada participante quando informados.
- Deck utilizado.
- Prints da Bandai arquivados no Supabase Storage.

### Jogador

- `name`: nome administrado e exibido no DigiStats.
- `digilab_name`: nome canônico utilizado na cópia e na comparação com o DigiLab.
- `bandai_id`: Bandai Member Number, enviado quando estiver cadastrado.

`bandai_id` é opcional. Sua ausência deve gerar um aviso, mas não impedir a cópia.

---

## Versão 1 — Cópia manual dos standings

### Objetivo

Gerar texto a partir de um torneio já salvo no DigiStats, copiá-lo para a área de transferência e colá-lo manualmente no DigiLab.

Esta versão não registra status de envio, não consulta a API do DigiLab e não acessa o Discord.

### Fluxo

```text
Abrir os detalhes do torneio no DigiStats
        ↓
Copiar dados DigiLab
        ↓
Revisar avisos de Bandai IDs ausentes
        ↓
Colar os dados manualmente no DigiLab
        ↓
Revisar os standings reconhecidos
        ↓
Documentar ajustes necessários no contrato
```

### Formato copiado

```text
1 PlayerName 0012345678 9
2 PlayerName 0012345678 7
```

Mapeamento de cada linha:

| Valor | Origem no DigiStats |
|---|---|
| Colocação | `tournament_results.placement` |
| Nome | `players.digilab_name`, com fallback defensivo para `players.name` |
| Bandai ID | `players.bandai_id` |
| Pontos | `tournament_results.match_points` |

Regras:

- Uma linha por participante.
- Ordem crescente por colocação.
- Bandai ID preservando os zeros à esquerda.
- Bandai ID e pontos podem ficar vazios.
- O deck não faz parte desta primeira cópia.

### Interface

O botão `Copiar dados DigiLab` fica no cabeçalho dos detalhes do torneio, ao lado de `Generate Post`.

Ao copiar:

- Se não houver resultados, nada é copiado e a interface exibe um erro.
- Se houver participantes sem Bandai ID, a interface lista os nomes e continua a cópia.
- O texto é gerado somente no navegador; nenhum estado adicional é persistido.

### Protocolo de validação manual

Para cada teste no importador do DigiLab, registrar:

| Item | Resultado |
|---|---|
| Texto aceito | Pendente |
| Colocação reconhecida | Pendente |
| `digilab_name` reconhecido | Pendente |
| Bandai ID reconhecido | Pendente |
| Pontos reconhecidos | Pendente |
| Campos ignorados ou rejeitados | Pendente |
| Mensagem apresentada pelo DigiLab | Pendente |

A Versão 1 será considerada validada quando o DigiLab aceitar o texto colado e apresentar corretamente os standings para revisão.

---

## Versão 2 — Confirmação de publicação

### Objetivo

Identificar que um torneio exportado já foi criado no DigiLab e associar o ID e a URL externos ao torneio local.

Esta versão será planejada e implementada somente depois da validação da cópia manual.

### Fluxo proposto

```text
Organizador solicita a verificação no DigiStats
        ↓
Backend lê as últimas 100 mensagens do canal do Discord
        ↓
Filtra mensagens do webhook do DigiLab
        ↓
Extrai o ID de /tournament/{id}
        ↓
Consulta os dados estruturados na API oficial do DigiLab
        ↓
Compara com o torneio local
        ↓
Match exato → marca como sincronizado
Ambiguidade → solicita revisão manual
```

### Discord

- O canal contém outras mensagens, portanto o filtro deve usar o `webhook_id` do DigiLab e uma URL válida de torneio.
- A verificação será inicialmente manual, sem polling ou processo permanente.
- Um bot deverá possuir apenas `View Channel` e `Read Message History`.
- Na primeira verificação poderão ser analisadas as últimas 100 mensagens; depois deverá ser salvo o último `message_id` processado.

### API do DigiLab

- A mensagem do Discord será apenas o sinal e a fonte do `tournament_id`.
- A API oficial será a fonte dos dados estruturados usados na confirmação.
- A consulta deverá ser executada por uma Supabase Edge Function.
- A resposta deverá ser processada de forma tolerante a novos campos, pois a API não possui versão fixa.

### Critério de correspondência

Um torneio só poderá ser marcado automaticamente quando houver um único candidato com correspondência exata de:

- Data.
- Nome normalizado da loja.
- Quantidade de participantes.
- Formato, quando disponível nos dois sistemas.
- Standings, comparando os nomes retornados pelo DigiLab com `players.digilab_name`.

Qualquer divergência ou múltiplos candidatos deverá exigir revisão manual.

### Segurança

- Token do bot Discord e chave da API DigiLab somente nos secrets do Supabase.
- Nunca incluir tokens, webhook privado ou service-role key no frontend ou repositório.
- A tabela de integração deverá permitir leitura pública apenas do status necessário e escrita somente pelo backend autorizado.
- A verificação deverá ser idempotente por `discord_message_id` e `digilab_tournament_id`.

---

## Evolução futura

Se o DigiLab disponibilizar uma API oficial de escrita, a exportação manual poderá ser substituída por criação autenticada com identificador externo idempotente. Automação por navegador ou endpoints internos não documentados continuará fora do escopo.
