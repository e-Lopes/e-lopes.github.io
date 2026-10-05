(function () {
    'use strict';
    const base = new URL('../../demo-v2/', document.currentScript.src);
    const url = (path) => new URL(path, base).href;
    const sections = {
        overview: [['Visão geral', '#overview']],
        tournaments: [
            ['Torneios recentes', '#tournaments'],
            ['Gerenciar torneios', 'tools.html?view=tournaments'],
            ['Cadastrar torneio', 'tools.html?view=tournaments&create=1']
        ],
        meta: [
            ['Metagame', '#meta'],
            ['Relatórios detalhados', 'tools.html?view=statistics']
        ],
        decks: [
            ['Catálogo de decks', 'tools.html?view=decks'],
            ['Cadastrar deck', 'tools.html?view=decks&action=create-deck']
        ],
        players: [
            ['Lista de jogadores', 'tools.html?view=players'],
            ['Cadastrar jogador', 'tools.html?view=players&action=create-player']
        ],
        admin: [
            ['Configurações', '#admin'],
            ['DigiLab e manutenção', 'tools.html?view=admin']
        ],
        posts: [['Editor de posts', '#posts']]
    };
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return;
    [...nav.children].forEach((link) => {
        const key =
            link.dataset.view ||
            (link.dataset.nativeNav === 'statistics' ? 'meta' : link.dataset.nativeNav) ||
            new URL(link.href).hash.slice(1);
        if (!sections[key]) return;
        const group = document.createElement('div');
        group.className = 'nav-group';
        group.dataset.navGroup = key;
        link.before(group);
        group.append(link);
        if (sections[key].length < 2) return;
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'nav-expand';
        const label = document.createElement('span');
        label.textContent = link.textContent.trim();
        const arrow = document.createElement('span');
        arrow.className = 'nav-chevron';
        arrow.textContent = '⌄';
        arrow.setAttribute('aria-hidden', 'true');
        toggle.append(label, arrow);
        toggle.setAttribute('aria-label', `Abrir ou fechar opções de ${link.textContent.trim()}`);
        toggle.setAttribute('aria-expanded', 'false');
        link.replaceWith(toggle);
        const submenu = document.createElement('div');
        submenu.className = 'nav-submenu';
        submenu.id = `nav-options-${key}`;
        toggle.setAttribute('aria-controls', submenu.id);
        submenu.hidden = true;
        submenu.setAttribute('aria-label', `Opções de ${link.textContent.trim()}`);
        sections[key].forEach(([label, path]) => {
            const child = document.createElement('a');
            child.textContent = label;
            child.href = url(path);
            submenu.append(child);
        });
        group.append(submenu);
        toggle.addEventListener('click', () => {
            const opened = submenu.hidden;
            nav.querySelectorAll('.nav-submenu').forEach((other) => {
                other.hidden = true;
                other.parentElement
                    .querySelector('.nav-expand')
                    .setAttribute('aria-expanded', 'false');
            });
            submenu.hidden = !opened;
            toggle.setAttribute('aria-expanded', String(opened));
        });
    });
    window.sectionNavigation = {
        setCurrent(route) {
            const key =
                {
                    manage: 'tournaments',
                    builder: 'tournaments',
                    statistics: 'meta',
                    integration: 'admin'
                }[route] || route;
            const current = new URL(window.location.href);
            nav.querySelectorAll('.nav-group').forEach((group) => {
                const selected = group.dataset.navGroup === key;
                group.classList.toggle('is-active', selected);
                const submenu = group.querySelector('.nav-submenu');
                if (submenu) {
                    const opened = selected && !window.matchMedia('(max-width: 780px)').matches;
                    submenu.hidden = !opened;
                    group
                        .querySelector('.nav-expand')
                        .setAttribute('aria-expanded', String(opened));
                }
                group.querySelectorAll('.nav-submenu a').forEach((link) => {
                    const target = new URL(link.href);
                    const active =
                        target.pathname === current.pathname &&
                        target.hash === current.hash &&
                        target.searchParams.get('view') === current.searchParams.get('view') &&
                        target.searchParams.get('action') === current.searchParams.get('action') &&
                        !target.searchParams.has('create');
                    if (active) link.setAttribute('aria-current', 'page');
                    else link.removeAttribute('aria-current');
                });
            });
        }
    };
})();
