'use strict';

window.DIGISTATS_NATIVE_V2 = true;
window.digiStatsComponentRoot = () => document.getElementById('v2Tools') || document.body;
const nativeRoutes = {
    tournaments: [
        'Gerenciar torneios',
        'Cadastre torneios, importe resultados e acompanhe as classificações.'
    ],
    decks: ['Decks', 'Gerencie o catálogo, imagens, cores e decklists.'],
    players: ['Jogadores', 'Cadastros, apelidos Bandai / DigiLab e histórico de resultados.'],
    admin: ['Admin / DigiLab', 'Sincronização, lojas, agenda, formatos e ferramentas do cenário.'],
    statistics: ['Estatísticas', 'Cartas, rankings, campeões por loja e análises detalhadas.'],
    builder: ['Deckbuilder', 'Monte e registre a decklist do resultado selecionado.']
};
function initNativeShell() {
    const params = new URLSearchParams(window.location.search);
    const route = window.location.pathname.endsWith('/deckbuilder.html')
        ? 'builder'
        : params.get('view') || 'tournaments';
    const labels = nativeRoutes[route] || nativeRoutes.tournaments;
    document.getElementById('nativePageTitle').textContent = labels[0];
    document.getElementById('nativePageLabel').textContent = labels[0];
    document.getElementById('nativePageDescription').textContent = labels[1];
    document.title = `DigiStats — ${labels[0]}`;
    window.sectionNavigation?.setCurrent(route);
    const back = document.getElementById('nativeBackLink');
    if (back) {
        const destination =
            { tournaments: 'tournaments', statistics: 'meta', admin: 'admin' }[route] || 'overview';
        back.href = new URL(`demo-v2/#${destination}`, document.baseURI).href;
    }
    document
        .querySelector(`[data-native-nav="${route === 'builder' ? 'tournaments' : route}"]`)
        ?.setAttribute('aria-current', 'page');
    const create = async () => {
        if (!params.has('create') && !params.has('action')) return;
        const action = params.get('action');
        const tournament = params.has('create') && route === 'tournaments';
        params.delete('create');
        params.delete('action');
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('create');
        cleanUrl.searchParams.delete('action');
        window.history.replaceState(window.history.state, '', cleanUrl);
        if (tournament && typeof openCreateTournamentModal === 'function')
            await openCreateTournamentModal();
        else if (route === 'decks' && action === 'create-deck')
            document.getElementById('btnOpenCreateDeckModal')?.click();
        else if (route === 'players' && action === 'create-player')
            document.getElementById('btnAddPlayer')?.click();
        window.sectionNavigation?.setCurrent(route);
    };
    if (window.digistatsToolsReady) create();
    else window.addEventListener('digistats:tools-ready', create, { once: true });
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href]');
        if (!link || link.target === '_blank' || event.ctrlKey || event.metaKey) return;
        const url = new URL(link.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname.includes('/torneios/decklist-builder/')) {
            const builder = new URL('demo-v2/deckbuilder.html', document.baseURI);
            builder.search = url.search;
            link.href = builder.href;
            return;
        }
        if (
            (url.pathname.endsWith('/index.html') || url.pathname.endsWith('/list-tournaments/')) &&
            url.searchParams.has('view')
        ) {
            const native = new URL('demo-v2/tools.html', document.baseURI);
            native.search = url.search;
            link.href = native.href;
        }
    });
}
initNativeShell();
