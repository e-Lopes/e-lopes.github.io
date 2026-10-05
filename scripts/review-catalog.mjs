// Optional browser smoke review. Start the local HTTP server and a headless Edge
// with --remote-debugging-port=9228, then run this file. All API data is mocked.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const targets = await (await fetch('http://127.0.0.1:9228/json/list')).json();
const target = targets.find((target) => target.type === 'page');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map(),
    errors = [];
function call(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
    });
}
socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
        const promise = pending.get(message.id);
        pending.delete(message.id);
        message.error
            ? promise.reject(Error(message.error.message))
            : promise.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown')
        errors.push(
            message.params.exceptionDetails.exception?.description ||
                message.params.exceptionDetails.text
        );
    else if (message.method === 'Fetch.requestPaused') {
        call('Fetch.fulfillRequest', {
            requestId: message.params.requestId,
            responseCode: 200,
            responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }],
            body: Buffer.from('window.Chart=class { destroy(){} update(){} };').toString('base64')
        });
    }
});
await call('Runtime.enable');
await call('Page.enable');
// Keep UI checks deterministic while a new service worker activates.
// The manifest's cache/update behavior is covered separately by Node tests.
await call('Network.setBypassServiceWorker', { bypass: true });
await call('Fetch.enable', {
    patterns: [{ urlPattern: '*cdn.jsdelivr.net*', resourceType: 'Script' }]
});
await call('Page.addScriptToEvaluateOnNewDocument', {
    source: `
(() => {
 if(navigator.serviceWorker) navigator.serviceWorker.register=async()=>({addEventListener(){},update:async()=>{}});
 const image=location.origin+'/icons/digimon-cwb-mark.svg?card=BT26-001';
 const players=Array.from({length:27},(_,i)=>({id:i+1,name:i===0?'Ana Santos':'Jogador '+String(i+1).padStart(2,'0'),bandai_nick:'Bandai '+(i+1),digilab_name:'DigiLab '+(i+1),bandai_id:'ID'+(i+1),is_active:i!==26}));
 const decks=[{id:1,name:'Glowing Dawn',colors:'r,p',is_active:true},{id:2,name:'Saiyu Warriors',colors:'y',is_active:true},{id:3,name:'Toho Braves',colors:'r,b',is_active:true}];
 const stores=[{id:1,name:'El-Kubo TCG',logo_url:image,is_active:true},{id:2,name:'Meruru',logo_url:image,is_active:true}];
 const tournaments=[{id:3,store_id:1,tournament_date:'2026-10-02',tournament_name:'Locals',total_players:7,format_id:1},{id:2,store_id:2,tournament_date:'2026-10-01',tournament_name:'Evo Cup',total_players:4,format_id:1},{id:1,store_id:1,tournament_date:'2026-09-29',tournament_name:'Locals',total_players:7,format_id:1}];
 const histories=[{id:101,tournament_id:3,store_id:1,player_id:1,deck_id:1,tournament_date:'2026-10-02',placement:1,decklist:null,store:{name:'El-Kubo TCG'},deck:{name:'Glowing Dawn'},player:{name:'Ana Santos'}}];
 const original=window.fetch.bind(window);
 window.__catalogWrites=[]; window.__metaReads=0;
 window.fetch=async (input,options={})=> {
  const url=new URL(typeof input==='string'?input:input.url,location.href);
  if(url.pathname.endsWith('/card-catalog.json')) {window.__builderCatalogReads=(window.__builderCatalogReads||0)+1; return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});}
  if(!url.pathname.includes('/rest/v1/')&&!url.pathname.includes('/functions/v1/')&&!url.pathname.includes('/auth/v1/'))return original(input,options);
  const table=url.pathname.split('/').pop();
  if(options.method&&options.method!=='GET'){
   const payload=JSON.parse(options.body||'{}'); window.__catalogWrites.push({table,method:options.method,payload});
   if(table==='players') { if(options.method==='POST')players.push({id:99,...payload,is_active:true}); else Object.assign(players.find(p=>String(p.id)===url.searchParams.get('id')?.slice(3)),payload); }
   return new Response(JSON.stringify(table==='upload-card-image'?{url:image}:table==='decks'&&options.method==='POST'?[{id:99}]:{}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  let data=({players,decks,stores,tournament:tournaments,formats:[{id:1,code:'BT26',name:'Timeless Bonds',created_at:'2026-09-01',is_active:true}],deck_images:decks.map(d=>({deck_id:d.id,image_url:image})),deck_families:[{id:'family1',name:'Família A',is_active:true}],tournament_weekly_schedule:[],v_podium_full:tournaments.map(t=>({id:t.id,tournament_id:t.id,store_id:t.store_id,tournament_date:t.tournament_date,placement:1,player:'Ana Santos',deck:'Glowing Dawn',image_url:image})),tournament_results:histories,decklists:[{id:'list1',decklist_cards:[{card_code:'BT26-001',qty:4,position:0}]}]})[table]||[];
  if(table==='tournament_results'&&url.searchParams.get('select')?.startsWith('id,tournament_id,deck_id')) {window.__metaReads++;}
  if(table==='tournament_results'&&url.searchParams.get('select')?.startsWith('id,tournament_id,deck_id')) data=histories.map(r=>({...r,decklists:[{id:'list1'}]}));
  if(table==='tournament'&&url.searchParams.has('id')) data=data.filter(d=>String(d.id)===url.searchParams.get('id').slice(3));
  if(table==='decks'&&url.searchParams.has('name')) data=data.filter(d=>d.name===url.searchParams.get('name').slice(3));
  if(Number(url.searchParams.get('offset'))>0)data=[];
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
 };
})();`
});
async function evaluate(expression) {
    const result = await call('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
    });
    if (result.exceptionDetails)
        throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
}
async function waitFor(expression) {
    for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate(expression)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw Error('Timed out: ' + expression);
}
async function click(text, scope = 'document') {
    assert.equal(
        await evaluate(
            `(() => { const button=[...${scope}.querySelectorAll('button')].find(button=>(button.textContent.trim()===${JSON.stringify(text)}||(button.closest('.analysis-tabs')&&button.firstChild?.textContent.trim()===${JSON.stringify(text)}))&&!button.disabled); if(!button)return false; button.click(); return true; })()`
        ),
        true,
        'Missing button ' + text
    );
}
async function screenshot(name) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const result = await call('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false
    });
    const destination = path.join(os.tmpdir(), `digimon-${name}.png`);
    await fs.writeFile(destination, Buffer.from(result.data, 'base64'));
    console.log(destination);
}
try {
    await call('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
    });
    await call('Network.setCacheDisabled', { cacheDisabled: true });
    await call('Page.navigate', { url: 'about:blank' });
    await call('Page.navigate', { url: 'http://127.0.0.1:4175/index.html?releaseCheck=1#players' });
    await waitFor('document.querySelectorAll(".catalog-row").length===20');
    assert.equal(await evaluate('location.pathname'), '/demo-v2/');
    assert.equal(await evaluate('new URLSearchParams(location.search).get("releaseCheck")'), '1');
    assert.equal(await evaluate('document.querySelectorAll("#v2Tools").length'), 0);
    await waitFor('!!document.querySelector(".site-theme-picker")');
    assert.ok(
        await evaluate(
            'getComputedStyle(document.querySelector("#sidebar-support")).display!=="none"'
        )
    );
    assert.ok(
        await evaluate(
            'document.querySelector("#sidebar-support").textContent.includes("Política de privacidade")'
        )
    );
    const initialAccent = await evaluate('document.documentElement.dataset.accent');
    const savedAccent = await evaluate('localStorage.getItem("digimon-cwb-accent")');
    await evaluate('document.querySelector(".site-theme-opener").click()');
    await waitFor('!!document.querySelector(".theme-dialog[open]")');
    await evaluate(`document.querySelector('[aria-label="Tema azul"]').click()`);
    assert.equal(await evaluate('document.documentElement.dataset.accent'), initialAccent);
    assert.equal(await evaluate('localStorage.getItem("digimon-cwb-accent")'), savedAccent);
    await waitFor(
        'getComputedStyle(document.querySelector(".theme-preview")).getPropertyValue("--accent").trim()==="#66a7f5"'
    );
    await click('Aplicar', 'document.querySelector(".theme-dialog")');
    assert.equal(await evaluate('localStorage.getItem("digimon-cwb-accent")'), 'blue');
    await call('Page.reload', { ignoreCache: true });
    await waitFor(
        'document.querySelectorAll(".catalog-row").length===20 && !!document.querySelector(".site-theme-picker")'
    );
    assert.equal(await evaluate('document.documentElement.dataset.accent'), 'blue');
    await evaluate('document.querySelector(".site-theme-opener").click()');
    await waitFor('!!document.querySelector(".theme-dialog[open]")');
    await evaluate(`document.querySelector('[aria-label="Tema verde"]').click()`);
    await click('Cancelar', 'document.querySelector(".theme-dialog")');
    assert.equal(await evaluate('document.documentElement.dataset.accent'), 'blue');
    await evaluate('document.querySelector(".site-theme-opener").click()');
    await waitFor('!!document.querySelector(".theme-dialog[open]")');
    await evaluate(`document.querySelector('[aria-label="Tema vermelho"]').click()`);
    await click('Aplicar', 'document.querySelector(".theme-dialog")');
    await screenshot('players-desktop');
    await evaluate('document.querySelector(".catalog-item").click()');
    await waitFor('!!document.querySelector("dialog[open]")');
    await click('Histórico', 'document.querySelector("dialog[open]")');
    await waitFor('document.querySelectorAll(".catalog-history-entry").length===1');
    await click('Decklist', 'document.querySelector("dialog[open]")');
    await waitFor('!!document.querySelector(".catalog-card-grid")');
    await evaluate('document.querySelector("dialog[open] > header button").click()');
    await click('+ Adicionar jogador');
    await waitFor('!!document.querySelector(".catalog-form")');
    await evaluate(
        `(() => {const original=window.fetch;window.__capturedWrites=[];window.fetch=(input,options={})=>{if(options.method==='POST'||options.method==='PATCH')window.__capturedWrites.push({method:options.method,payload:JSON.parse(options.body||'{}')});return original(input,options);};})()`
    );
    await evaluate(
        `(() => {const input=document.querySelector('.catalog-form input');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'Novo jogador');input.dispatchEvent(new Event('input',{bubbles:true}));})()`
    );
    await screenshot('player-create');
    console.log(
        await evaluate(
            'JSON.stringify({value:document.querySelector(".catalog-form input").value,forms:document.querySelectorAll(".catalog-form").length,method:document.querySelector(".catalog-form").method})'
        )
    );
    await evaluate('document.querySelector(".catalog-form").requestSubmit()');
    await waitFor('window.__capturedWrites.length > 0');
    await waitFor('!document.querySelector("dialog[open]")');
    assert.equal(await evaluate('window.__capturedWrites[0].payload.name'), 'Novo jogador');
    await evaluate('window.digistatsNavigate("decks")');
    await waitFor('document.querySelectorAll(".catalog-row").length===3');
    await click('Grade');
    await screenshot('decks-desktop');
    await evaluate('window.digistatsNavigate("decks", {deckId:"1"})');
    await waitFor('!!document.querySelector(".catalog-history-heading")');
    assert.ok(
        await evaluate('!!document.querySelector(".list-dialog > header .catalog-deck-header")')
    );
    assert.ok(
        await evaluate(
            '![...document.querySelectorAll(".catalog-tabs button")].some(b=>b.textContent.trim()==="Informa??es")'
        )
    );
    await evaluate('document.querySelector(".list-dialog button[aria-label=Fechar]").click()');
    await click('+ Adicionar deck');
    await waitFor('!!document.querySelector(".catalog-form")');
    await evaluate('document.querySelector("dialog[open] > header button").click()');
    await evaluate('window.digistatsNavigate("tournaments")');
    await waitFor('document.querySelectorAll(".tournament-list-row").length===3');
    await screenshot('tournaments-desktop');
    await click('Calendário');
    await waitFor('!!document.querySelector(".tournament-calendar")');
    await screenshot('calendar-desktop');
    await click('+ Adicionar torneio');
    await waitFor('!!document.querySelector("#createModal.active")');
    await waitFor(`!!document.querySelector('#createTournamentForm[data-step="0"]')`);
    await screenshot('tournament-create');
    assert.equal(await evaluate('document.querySelector("#createTournamentName").value'), 'Locals');
    console.log(
        await evaluate(
            'JSON.stringify({defaultType:document.querySelector("#createTournamentName").value,sourceHasLocals:window.openCreateTournamentModal.toString().includes("Locals")})'
        )
    );
    await evaluate(
        `(() => {const select=document.querySelector('#createStoreSelect');select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#createTournamentName').value='Locals';})()`
    );
    await click('Participantes e resultados →', 'document.querySelector("#createModal")');
    await waitFor(`!!document.querySelector('#createTournamentForm[data-step="1"]')`);
    await click('Revisar →', 'document.querySelector("#createModal")');
    assert.ok(
        await evaluate(
            'document.querySelector(".react-tournament-steps").textContent.includes("Adicione pelo menos")'
        )
    );
    await click('+ Jogador', 'document.querySelector("#createModal")');
    await evaluate(
        `(() => {const input=document.querySelector('#createResultsRows .player-input');input.value='Ana Santos';input.dispatchEvent(new Event('input',{bubbles:true}));})()`
    );
    await waitFor('!!document.querySelector("#createResultsRows .autocomplete-item")');
    await evaluate('document.querySelector("#createResultsRows .autocomplete-item").click()');
    await click('Revisar →', 'document.querySelector("#createModal")');
    await waitFor(`!!document.querySelector('#createTournamentForm[data-step="2"]')`);
    await screenshot('tournament-review');
    await evaluate('document.querySelector("#btnCreateModalCloseX").click()');
    await waitFor('!document.querySelector("#createModal.active")');
    await evaluate('window.digistatsNavigate("admin")');
    await waitFor('!!document.querySelector("#v2Tools .workspace-page-header")');
    const inventory = await evaluate(
        `(()=>{const b=[...document.querySelectorAll('#v2Tools button')].find(b=>b.textContent.includes('Atualizar invent'));return b?{background:getComputedStyle(b).backgroundColor,color:getComputedStyle(b).color}:null})()`
    );
    assert.ok(inventory, 'Missing inventory action');
    assert.equal(inventory.color, 'rgb(239, 100, 107)');
    assert.notEqual(inventory.background, 'rgb(239, 100, 107)');
    await evaluate('window.digistatsNavigate("tournaments")');
    await waitFor('document.querySelectorAll(".tournament-list-row").length===3');
    await call('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true
    });
    assert.ok(
        await evaluate('document.documentElement.scrollWidth<=innerWidth'),
        'Mobile horizontal overflow'
    );
    await screenshot('tournaments-mobile');
    await call('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
    });
    await evaluate('window.digistatsNavigate("posts")');
    await waitFor('!!document.querySelector(".studio canvas")');
    const positions = await evaluate(
        '(()=>{const preview=document.querySelector(".post-preview").getBoundingClientRect();const heading=document.querySelector(".studio-view .page-heading").getBoundingClientRect();const canvas=document.querySelector(".studio canvas").getBoundingClientRect();return {preview:preview.top,heading:heading.top,bottom:canvas.bottom,height:innerHeight};})()'
    );
    assert.ok(Math.abs(positions.preview - positions.heading) < 2, JSON.stringify(positions));
    assert.ok(positions.bottom <= positions.height, JSON.stringify(positions));
    await screenshot('studio-desktop');
    await evaluate('window.digistatsNavigate("overview")');
    await waitFor(
        'document.querySelectorAll(".highlights-column").length===3 && !!document.querySelector(".highlight-row")'
    );
    assert.ok(
        await evaluate(
            'document.querySelector(".highlights-period").textContent.includes("07/09/2026")'
        )
    );
    await screenshot('overview-highlights');
    const carouselRed = await evaluate(
        'getComputedStyle(document.querySelector(".recent-tournaments-track"),"::before").backgroundImage'
    );
    await evaluate('document.querySelector(".site-theme-opener").click()');
    await waitFor('!!document.querySelector(".theme-dialog[open]")');
    await evaluate(`document.querySelector('[aria-label="Tema azul"]').click()`);
    assert.equal(
        await evaluate(
            'getComputedStyle(document.querySelector(".recent-tournaments-track"),"::before").backgroundImage'
        ),
        carouselRed
    );
    const spinnerTheme = await evaluate(
        '(()=>{const s=document.createElement("span");s.className="v2-loader";document.body.append(s);const result={spinner:getComputedStyle(s).backgroundImage,icon:getComputedStyle(document.querySelector(".sidebar .hazard")).backgroundImage,mask:getComputedStyle(s).maskImage,animation:getComputedStyle(s).animationName};s.remove();return result})()'
    );
    assert.equal(spinnerTheme.spinner, spinnerTheme.icon);
    assert.ok(spinnerTheme.mask.startsWith('url('));
    assert.equal(spinnerTheme.animation, 'digital-hazard-spin');
    await screenshot('theme-preview-blue');
    await click('Cancelar', 'document.querySelector(".theme-dialog")');
    assert.equal(await evaluate('document.documentElement.dataset.accent'), 'red');
    await evaluate('window.digistatsNavigate("meta")');
    await waitFor('document.querySelectorAll(".meta-results-table tbody tr").length===1');
    assert.ok(
        await evaluate(
            'document.querySelector(".meta-format-heading").textContent.includes("BT26")'
        )
    );
    await screenshot('metagame-desktop');
    const metaReads = await evaluate('window.__metaReads');
    await evaluate('window.digistatsNavigate("overview")');
    await waitFor('!!document.querySelector(".highlight-row")');
    assert.equal(await evaluate('window.__metaReads'), metaReads, 'Overview should reuse results');
    assert.ok(
        await evaluate(
            '!document.querySelector(".overview-highlights").textContent.includes("Carregando destaques")'
        )
    );
    await evaluate('window.digistatsNavigate("meta")');
    await waitFor('!!document.querySelector(".meta-deck-button")');
    await evaluate('document.querySelector(".meta-deck-button").click()');
    await waitFor('!!document.querySelector(".list-dialog[open]")');
    await click('Fechar', 'document.querySelector(".list-dialog")').catch(async () =>
        evaluate('document.querySelector(".list-dialog button[aria-label=Fechar]").click()')
    );
    await click('Comunidade');
    await waitFor(
        'document.querySelector(".meta-results-table").textContent.includes("Ana Santos")'
    );
    await click('Decklists');
    await waitFor('!!document.querySelector(".meta-list-cards button")');
    await click('Metagame', 'document.querySelector(".analysis-tabs")');
    await call('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true
    });
    assert.ok(
        await evaluate('document.documentElement.scrollWidth<=innerWidth'),
        'Metagame mobile overflow'
    );
    await screenshot('metagame-mobile');
    await evaluate('window.digistatsNavigate("builder", {returnView:"meta"})');
    await waitFor('!!document.querySelector(".builder-desktop-notice")');
    assert.equal(
        await evaluate('window.__builderCatalogReads||0'),
        0,
        'Mobile must not load builder catalog'
    );
    assert.equal(
        await evaluate('getComputedStyle(document.querySelector("[data-builder-root]")).display'),
        'none'
    );
    await screenshot('builder-mobile-notice');
    await call('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
    });
    await waitFor(
        '!!window.initializeDeckbuilder && !document.querySelector(".builder-desktop-notice")'
    );
    await waitFor('(window.__builderCatalogReads||0)>0');
    assert.ok(await evaluate('!!document.querySelector("#btnDecklistBuilderExportImage")'));
    assert.ok(
        await evaluate('document.documentElement.scrollWidth<=innerWidth'),
        'Desktop builder overflow'
    );
    await screenshot('builder-desktop');
    await evaluate('window.digistatsNavigate("meta")');
    await waitFor('!!document.querySelector(".metagame-view")');
    for (const width of [320, 390, 430]) {
        await call('Emulation.setDeviceMetricsOverride', {
            width,
            height: 844,
            deviceScaleFactor: 1,
            mobile: true
        });
        await evaluate('document.querySelector("button[aria-controls=app-navigation]").click()');
        await waitFor('!document.querySelector("#app-navigation").hidden');
        const menu = await evaluate(`(() => {
            const links = [...document.querySelectorAll('#app-navigation > .nav-group')].map(element => element.getBoundingClientRect());
            const support = getComputedStyle(document.querySelector('.sidebar-support nav'));
            return { aligned: links.every(rect => Math.abs(rect.left-links[0].left)<1 && Math.abs(rect.width-links[0].width)<1), columns: support.gridTemplateColumns.split(' ').length, overflow: document.documentElement.scrollWidth>innerWidth };
        })()`);
        assert.ok(menu.aligned, 'Mobile navigation must form one column at ' + width);
        assert.equal(menu.columns, 1, 'Mobile support must form one column');
        assert.equal(menu.overflow, false, 'Mobile menu overflow at ' + width);
        if (width === 390) await screenshot('navigation-mobile');
        await evaluate('document.querySelector("button[aria-controls=app-navigation]").click()');
        for (const [route, selector] of [
            ['overview', '.overview-highlights'],
            ['decks', '.catalog-app'],
            ['players', '.catalog-app'],
            ['tournaments', '.tournament-list-row'],
            ['posts', '.studio canvas'],
            ['meta', '.metagame-view']
        ]) {
            await evaluate(`window.digistatsNavigate(${JSON.stringify(route)})`);
            await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`);
            assert.ok(
                await evaluate('document.documentElement.scrollWidth<=innerWidth'),
                route + ' overflow at ' + width
            );
            if (width === 390) await screenshot(route + '-mobile-release');
        }
    }
    await evaluate('window.digistatsNavigate("statistics")');
    await waitFor('!!document.querySelector(".metagame-view")');
    assert.deepEqual(errors, []);
    console.log('Browser smoke checks passed.');
} catch (error) {
    console.log(
        await evaluate(
            'JSON.stringify({url:location.href,writes:window.__catalogWrites,notice:document.querySelector(".catalog-notice")?.textContent,form:document.querySelector(".catalog-form")?.textContent})'
        )
    );
    console.log(await evaluate('document.body?.innerText.slice(-1200)'));
    throw error;
} finally {
    socket.close();
}
