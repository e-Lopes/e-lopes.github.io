# Enquadramento dos retratos circulares

No **Admin → Cartas → Enquadramento**, abra **Ajustar enquadramento** e busque pelo nome do deck cadastrado ou pelo código de sua carta de exibição. A seleção usa a imagem do registro do deck; apenas decks ativos com uma carta identificável aparecem. **Enquadramentos salvos** permite voltar aos ajustes pelo nome do deck. O editor fica oculto sem uma sessão administrativa validada e é ocultado novamente ao sair ou invalidar a sessão.

Arraste a imagem na prévia circular, ajuste posição horizontal/vertical e zoom ou informe o centro horizontal em pixels da imagem carregada. **Salvar enquadramento** aplica o ajuste a todos os retratos React e aos posts de pódio e resumo semanal. **Restaurar padrão** restaura a prévia; salvar confirma a restauração.

`card_portrait_settings` guarda `center_x` como fração da largura, `offset_y` como deslocamento em fração da altura e `zoom`. Assim, o recorte funciona em diferentes resoluções da mesma carta. O padrão é centro horizontal 0,5, deslocamento vertical zero e zoom 2,3 com origem vertical em 20%. BT24-101 recebe inicialmente `center_x = 220 / 430`; reaplicar a migration preserva alterações posteriores.

Leitura pública; insert, update e delete exigem um usuário autenticado presente em `admin_users`, protegidos por RLS. O catálogo DigiLab não modifica esses ajustes. A migration `20261006020000_card_portrait_settings.sql` integra o deploy de schema no CI. Para aplicar manualmente com `SUPABASE_DB_URL` no `.env` e a dependência `pg` em `.tmp/digilab-tools`, execute `node scripts/deploy-card-portraits.mjs`.

`shared/data/card-portraits.js` carrega os ajustes antes de publicar os dados da aplicação. Após salvar, o evento `digistats:portraits-changed` atualiza os retratos montados e a prévia do post. Se uma atualização falhar, os ajustes já carregados são mantidos.
