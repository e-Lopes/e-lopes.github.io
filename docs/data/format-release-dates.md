# Datas de início dos formatos

Pesquisa realizada em **05/10/2026**, cobrindo os **14 formatos presentes no catálogo público do projeto**, incluindo o BT14 inativo, e o **EX09 da lista enviada**, ainda ausente do banco. Não adiciona formatos ao catálogo.

O critério confirmado é o lançamento oficial do produto em inglês divulgado pela Bandai para o mercado ocidental. O projeto identifica períodos de metagame pelas edições; aqui, o início de cada período é convencionado como o lançamento dessa edição. Não são usados o lançamento japonês, o pré-release, o primeiro torneio registrado ou a data de cadastro no DigiStats. A pesquisa não comprova a chegada física de cada produto às lojas de Curitiba.

## Levantamento

Ordenado do mais recente para o mais antigo. Cada fonte é a página oficial do produto e informa sua data de lançamento.

| Código no DigiStats | Produto em inglês                 | Início do formato | Fonte Bandai                                                        |
| ------------------- | --------------------------------- | ----------------- | ------------------------------------------------------------------- |
| EX13                | Chivalrous XIII                   | 02/10/2026        | [EX-13](https://world.digimoncard.com/products/pack/ex-13/)         |
| BT26                | Timeless Bonds                    | 04/09/2026        | [BT-26](https://world.digimoncard.com/products/pack/ver26/)         |
| EX12                | Digital World Shambala            | 03/07/2026        | [EX-12](https://world.digimoncard.com/products/pack/ex-12/)         |
| BT25                | Dual Revolution                   | 22/05/2026        | [BT-25](https://world.digimoncard.com/products/pack/ver25/)         |
| AD01                | Digimon Generation                | 27/03/2026        | [AD-01](https://world.digimoncard.com/products/pack/ad-01/)         |
| EX11                | Dawn of Liberator                 | 13/02/2026        | [EX-11](https://world.digimoncard.com/products/pack/ex-11/)         |
| BT24                | Time Stranger                     | 23/01/2026        | [BT-24](https://world.digimoncard.com/products/pack/ver24/)         |
| BT23                | Hackers' Slumber                  | 24/10/2025        | [BT-23](https://world.digimoncard.com/products/pack/ver23/)         |
| EX10                | Sinister Order                    | 19/09/2025        | [EX-10](https://world.digimoncard.com/products/pack/ex-10/)         |
| BT22                | Cyber Eden                        | 25/07/2025        | [BT-22](https://world.digimoncard.com/products/pack/ver22/)         |
| EX09                | Versus Monsters                   | 26/06/2025        | [EX-09](https://world.digimoncard.com/products/pack/ex-09/)         |
| BT21                | World Convergence                 | 25/04/2025        | [BT-21](https://world.digimoncard.com/products/pack/ver21/)         |
| RSB2.5              | Special Booster Ver.2.5 [BT19-20] | 28/02/2025        | [Ver.2.5](https://world.digimoncard.com/products/pack/ver19-20/)    |
| RSB2.0              | Special Booster Ver.2.0 [BT18-19] | 01/11/2024        | [Ver.2.0](https://world.digimoncard.com/products/pack/ver18-19/)    |
| BT14                | Blast Ace                         | 17/11/2023        | [BT-14](https://world.digimoncard.com/products/pack/ver14/special/) |

`RSB2.0` e `RSB2.5` são os códigos locais dos produtos Special Booster Ver.2.0 e Ver.2.5. A migration preserva esses códigos; não os confunde com uma edição “RSB2” única. Os nomes de exibição seguem o print: **Release Special Booster 2.0** e **Release Special Booster 2.5**.

## Migration

Arquivo: [20261005000000_correct_format_release_dates.sql](../../database/migrations/20261005000000_correct_format_release_dates.sql).

Atualiza `public.formats.created_at` e `name` dos códigos conhecidos, inclusive inativos. Não insere formatos, não troca o padrão e não altera torneios, IDs ou imagens. Pode ser executada novamente: datas e nomes já corrigidos não recebem outra atualização. Formatos sem data pesquisada permanecem intactos. O EX09 só recebe atualização se já existir no momento da aplicação.

Como a fonte fornece uma data, sem horário de lançamento, o timestamp representa **00:00 em America/Sao_Paulo** nessa data. A conversão é explícita e não depende do fuso da conexão com o banco. Para os lançamentos pesquisados, isso corresponde a 03:00 UTC.

Os filtros de formato da visão geral, torneios, metagame, cadastros e relatórios passam a mostrar **Nome - Código**, por exemplo **Chivalrous XIII - EX13**. O valor interno de cada opção continua sendo o código, preservando os filtros e a seleção de torneios. Nomes ainda iguais ao código usam apenas o código até a aplicação da migration.

Abra o arquivo no SQL Editor do Supabase e execute como administrador do banco. A criação do arquivo e os testes locais não aplicam a migration ao Supabase remoto. Se precisar conservar o histórico de cadastro antes de aplicá-la, exporte `select id, code, created_at from public.formats order by id;`.

Após aplicar, confira:

```sql
select
    id,
    code,
    name,
    (created_at at time zone 'America/Sao_Paulo')::date as release_date,
    is_active,
    is_default
from public.formats
order by created_at desc, id desc;
```

A ordenação da v2 já usa `created_at desc`. Esta correção coloca os formatos na ordem dos lançamentos, mesmo quando um formato antigo foi cadastrado recentemente. O valor padrão da coluna continua sendo `now()`; novos formatos precisarão receber a data de lançamento verificada para seguir essa convenção.
