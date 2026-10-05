'use strict';
const workspaceRoutes = {
    decks: 'decks',
    players: 'players',
    integration: 'admin',
    manage: 'tournaments',
    statistics: 'statistics'
};
let workspaceCreatePending = false;
function openWorkspace(route) {
    if (!Object.hasOwn(workspaceRoutes, route)) return;
    const url = new URL('tools.html', window.location.href);
    url.searchParams.set('view', workspaceRoutes[route]);
    if (route === 'manage' && workspaceCreatePending) url.searchParams.set('create', '1');
    window.location.assign(url.href);
}
function initWorkspace() {
    document.addEventListener('click', (event) => {
        if (!event.target.closest('[data-workspace-create]')) return;
        workspaceCreatePending = true;
        if (window.location.hash === '#manage') openWorkspace('manage');
    });
}
