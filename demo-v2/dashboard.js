'use strict';

const siteData = { events: [], stores: [], formats: [], schedule: [] };
let activePeriod = '';
let dataLoading = false;

function dashboardMetrics(rows) {
    return rows
        .map(
            ([label, value, detail]) =>
                `<article class="metric"><span class="metric-label">${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(detail)}</small></article>`
        )
        .join('');
}
function periodEvents() {
    if (!activePeriod) return siteData.events;
    if (activePeriod.startsWith('month:'))
        return siteData.events.filter((event) => event.isoDate.startsWith(activePeriod.slice(6)));
    const start = activePeriod.slice(5),
        end = liveData.weekEnd(start);
    return siteData.events.filter((event) => event.isoDate >= start && event.isoDate <= end);
}
function periodLabel() {
    return (
        document.getElementById('dataPeriod').selectedOptions[0]?.textContent || 'Todos os períodos'
    );
}
function participationRows(events) {
    const decks = new Map();
    events
        .filter((event) => !event.deckless)
        .forEach((event) =>
            event.results.forEach((result) => {
                if (!decks.has(result.deck))
                    decks.set(result.deck, { deck: result.deck, image: result.image, count: 0 });
                const deck = decks.get(result.deck);
                deck.count++;
                if (!deck.image) deck.image = result.image;
            })
        );
    return [...decks.values()].sort((a, b) => b.count - a.count || a.deck.localeCompare(b.deck));
}
function resultImage(player, className = 'art') {
    return player?.image
        ? `<span class="${className} art-portrait"><img src="${escapeHtml(player.image)}" alt="" loading="lazy" /></span>`
        : `<span class="${className} image-placeholder" aria-hidden="true">—</span>`;
}
function eventResultIdentity(event, player) {
    return event.deckless
        ? `<div><strong>${escapeHtml(player.name)}</strong></div>`
        : `${resultImage(player)}<div><strong>${escapeHtml(player.deck)}</strong><span>${escapeHtml(player.name)}</span></div>`;
}
function storeImage(store) {
    const url = liveData.validImage(store.logo_url || store.logo);
    return url
        ? `<img class="store-logo" src="${escapeHtml(url)}" alt="" loading="lazy" />`
        : '<span class="store-logo image-placeholder" aria-hidden="true">—</span>';
}
function dashboardEventCard(event) {
    const winner = event.winner;
    const podium = event.podium.filter(Boolean);
    const remaining = event.results.filter((player) => player.placement > 3);
    const topThree = podium
        .map(
            (player) =>
                `<div class="card-podium-row${event.deckless ? ' deckless' : ''}"><span class="card-place place-${player.placement - 1}" aria-label="${player.placement}º lugar">${player.placement}º</span>${eventResultIdentity(event, player)}</div>`
        )
        .join('');
    const others = remaining.length
        ? `<details class="card-other-results"><summary>Mais ${remaining.length} ${remaining.length === 1 ? 'resultado' : 'resultados'}</summary><div>${remaining.map((player) => `<div class="card-result-row"><span>${player.placement}º</span><div><strong>${escapeHtml(player.name)}</strong>${event.deckless ? '' : `<span>${escapeHtml(player.deck)}</span>`}</div></div>`).join('')}</div></details>`
        : '';
    return `<article class="event-card"><div class="event-top"><span>${event.date} · ${event.players} jogadores</span><span class="event-format">${escapeHtml(event.format)}</span></div><h3>${escapeHtml(event.title)}</h3><div class="store-info">${storeImage(event)}<p class="store-name">${escapeHtml(event.store)} · Curitiba</p></div><div class="card-podium" aria-label="Top 3">${topThree || '<p class="muted">Pódio ainda não registrado.</p>'}</div>${others}<div class="card-actions"><button class="text-button" type="button" data-event-details="${escapeHtml(event.id)}">Ver resultados</button>${winner ? `<a class="event-link" href="#posts" data-post-event="${escapeHtml(event.id)}">Criar post ↗</a>` : ''}</div></article>`;
}
function filterTournaments() {
    const query = document
        .getElementById('tournamentSearch')
        .value.toLocaleLowerCase('pt-BR')
        .trim();
    const store = document.getElementById('tournamentStore').value;
    const format = document.getElementById('tournamentFormat').value;
    const events = liveData
        .eventsForFormat(periodEvents(), format)
        .filter(
            (event) =>
                (!store || event.storeId === store) &&
                `${event.store} ${event.title} ${event.results.map((result) => `${result.deck} ${result.name}`).join(' ')}`
                    .toLocaleLowerCase('pt-BR')
                    .includes(query)
        );
    if (document.getElementById('tournamentOrder').value === 'players')
        events.sort((a, b) => b.players - a.players);
    document.getElementById('allTournaments').innerHTML = events.map(dashboardEventCard).join('');
    document.getElementById('noTournaments').hidden = events.length > 0;
    document.getElementById('tournamentCount').textContent =
        `${events.length} de ${periodEvents().length} torneios · ${periodLabel()}`;
}
function renderMetagame() {
    const store = document.getElementById('metaStore').value,
        format = document.getElementById('metaFormat').value;
    const events = liveData
        .eventsForFormat(periodEvents(), format)
        .filter((event) => !store || event.storeId === store);
    const rows = participationRows(events),
        total = rows.reduce((sum, row) => sum + row.count, 0);
    document.getElementById('metaMetrics').innerHTML = dashboardMetrics([
        [
            'Resultados registrados',
            total,
            `${events.reduce((sum, event) => sum + event.players, 0)} entradas nos torneios`
        ],
        ['Torneios', events.length, periodLabel()],
        [
            'Deck mais jogado',
            rows[0]?.deck || '—',
            rows[0]
                ? `${((rows[0].count / total) * 100).toFixed(1).replace('.', ',')}% dos resultados`
                : 'Sem resultados no período'
        ]
    ]);
    document.getElementById('metaSample').textContent =
        `${total} resultados · ${events.length} torneios`;
    document.getElementById('metaRows').innerHTML = rows.length
        ? rows
              .map((row, index) => {
                  const percent = (row.count / total) * 100;
                  return `<div class="meta-row dashboard-meta-row"><span class="meta-rank">${String(index + 1).padStart(2, '0')}</span>${resultImage(row)}<strong>${escapeHtml(row.deck)}</strong><div class="meta-bar"><span style="width:${percent}%"></span></div><span class="meta-number">${percent.toFixed(1).replace('.', ',')}%<small>${row.count} resultados</small></span></div>`;
              })
              .join('')
        : '<p class="muted">Nenhum resultado encontrado com estes filtros.</p>';
    const analysis = resultStatistics.analyze(events);
    const statsTable = (items, players) =>
        items.length
            ? `<div class="analysis-table-scroll"><table class="analysis-table"><thead><tr><th scope="col">${players ? 'Jogador' : 'Deck'}</th><th scope="col">Títulos</th><th scope="col">Top 3</th><th scope="col">Participações</th>${players ? '' : '<th scope="col">Conversão em títulos</th>'}</tr></thead><tbody>${items.map((row) => `<tr><th scope="row"><div class="analysis-name">${resultImage(row)}<span>${escapeHtml(row.name)}</span></div></th><td>${row.titles}</td><td>${row.top3}</td><td>${row.count}</td>${players ? '' : `<td>${row.eligible ? `${((row.titles / row.eligible) * 100).toFixed(1).replace('.', ',')}%` : '—'}<small>${row.eligible} participações elegíveis</small></td>`}</tr>`).join('')}</tbody></table></div>`
            : '<p class="muted">Nenhum resultado encontrado com estes filtros.</p>';
    document.getElementById('metaPerformanceRows').innerHTML = statsTable(analysis.decks, false);
    document.getElementById('metaPlayerRows').innerHTML = statsTable(analysis.players, true);
}
function switchAnalysis(tab) {
    document.querySelectorAll('[data-analysis]').forEach((button) => {
        const active = button.dataset.analysis === tab;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
        document.getElementById(button.getAttribute('aria-controls')).hidden = !active;
    });
}
function openEventDetails(id) {
    const event = siteData.events.find((item) => item.id === id);
    if (!event) return;
    document.getElementById('eventDialogTitle').textContent = `${event.store} · ${event.date}`;
    document.getElementById('eventDialogBody').innerHTML =
        `<p class="muted">${escapeHtml(event.title)} · ${event.players} jogadores · ${escapeHtml(event.format)} · ${event.results.length} resultados</p><div class="podium-details">${event.results.map((player) => `<div class="podium-detail${event.deckless ? ' deckless' : ''}"><span class="podium-place place-${player.placement - 1}">${player.placement === 1 ? 'WINNER' : `${player.placement}º`}</span>${eventResultIdentity(event, player)}</div>`).join('') || '<p class="muted">Resultados ainda não registrados.</p>'}</div>${event.winner ? `<a class="button primary" href="#posts" data-post-event="${escapeHtml(event.id)}">Criar post deste torneio ↗</a>` : ''}`;
    document.getElementById('eventDialog').showModal();
}
function renderAdmin() {
    const events = periodEvents(),
        authorized = Boolean(adminSession.profile);
    document.getElementById('liveAdminLogin').hidden = authorized;
    document.getElementById('liveAdminSession').hidden = !authorized;
    document.getElementById('liveAdminTools').hidden = !authorized;
    if (!authorized) {
        ['adminReviewRows', 'adminStoreRows', 'adminFormatRows', 'adminMetrics'].forEach((id) => {
            document.getElementById(id).replaceChildren();
        });
        return;
    }
    document.getElementById('liveAdminName').textContent =
        adminSession.profile?.display_name || adminSession.profile?.username || '';
    document.getElementById('adminMetrics').innerHTML = dashboardMetrics([
        ['Torneios', events.length, periodLabel()],
        ['Com campeão', events.filter((event) => event.winner).length, 'Primeiro lugar registrado'],
        ['Lojas cadastradas', siteData.stores.length, 'Catálogo de lojas']
    ]);
    document.getElementById('adminReviewRows').innerHTML =
        events
            .map(
                (event) =>
                    `<div class="review-row"><div><strong>${escapeHtml(event.store)}</strong><small>${event.date} · ${event.players} jogadores · ${escapeHtml(event.format)}</small></div><span class="pill ${event.winner ? 'reviewed' : ''}">${event.results.length} resultados</span><button type="button" class="text-button" data-event-details="${escapeHtml(event.id)}">Ver resultados</button><a class="button secondary" href="#manage">Gerenciar torneios ↗</a></div>`
            )
            .join('') || '<p class="muted">Nenhum torneio no período.</p>';
    document.getElementById('adminStoreRows').innerHTML = siteData.stores
        .map(
            (store) =>
                `<form class="store-edit-form" data-store-edit="${escapeHtml(String(store.id))}">${storeImage(store)}<label>Nome da loja<input name="storeName" value="${escapeHtml(store.name)}" required maxlength="60" ${authorized ? '' : 'disabled'} /></label><span class="pill">${store.is_active === false ? 'Inativa' : 'Ativa'}</span><button type="submit" class="button secondary" ${authorized ? '' : 'disabled'}>Salvar loja</button><p class="muted store-save-status" role="status"></p></form>`
        )
        .join('');
    document.getElementById('adminFormatRows').innerHTML = siteData.formats
        .map(
            (format) =>
                `<div class="review-row"><strong>${escapeHtml(format.code)}</strong><span class="pill">${format.is_default ? 'Padrão' : format.is_active ? 'Ativo' : 'Inativo'}</span><span class="muted">${escapeHtml(format.name || '')}</span></div>`
        )
        .join('');
}
function switchAdminPanel(tab) {
    if (!adminSession.profile) return;
    document.querySelectorAll('[data-admin-tab]').forEach((button) => {
        const active = button.dataset.adminTab === tab;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
        document.getElementById(button.getAttribute('aria-controls')).hidden = !active;
    });
}
function renderDashboard() {
    const format = document.getElementById('overviewFormat').value;
    const events = liveData.eventsForFormat(siteData.events, format);
    const rows = participationRows(events),
        total = rows.reduce((sum, row) => sum + row.count, 0);
    const identifiedDecks = rows.filter((row) => row.deck !== 'Deck não informado');
    const unidentified = total - identifiedDecks.reduce((sum, row) => sum + row.count, 0);
    document.getElementById('recentTournaments').innerHTML =
        events.slice(0, 3).map(dashboardEventCard).join('') ||
        '<p class="muted">Nenhum torneio cadastrado neste formato.</p>';
    document.getElementById('overviewDeckScope').textContent =
        `${format || 'Sem formato'} · ${total} resultados registrados${unidentified ? ` · ${unidentified} sem deck identificado` : ''}`;
    document.getElementById('overviewStoreScope').textContent =
        `Lojas com torneios em ${format || 'formato não informado'}`;
    document.getElementById('overviewDecks').innerHTML =
        identifiedDecks
            .slice(0, 3)
            .map(
                (row) =>
                    `<div class="overview-deck">${resultImage(row)}<div><strong>${escapeHtml(row.deck)}</strong><small>${row.count} resultados</small></div><span>${((row.count / total) * 100).toFixed(1).replace('.', ',')}%</span></div>`
            )
            .join('') ||
        '<p class="muted">Nenhum deck identificado nos resultados deste formato.</p>';
    const days = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
    const storesInFormat = new Set(events.map((event) => event.storeId));
    document.getElementById('overviewSchedule').innerHTML =
        siteData.schedule
            .filter(
                (entry) => entry.is_active !== false && storesInFormat.has(String(entry.store_id))
            )
            .map((entry) => {
                const store = siteData.stores.find(
                    (item) => String(item.id) === String(entry.store_id)
                );
                return store
                    ? `<a class="schedule-row" href="#tournaments" data-filter-store="${escapeHtml(String(store.id))}"><span>${days[entry.weekday]}</span>${storeImage(store)}<strong>${escapeHtml(store.name)}</strong><span>↗</span></a>`
                    : '';
            })
            .join('') || '<p class="muted">Nenhuma loja com agenda cadastrada neste formato.</p>';
    filterTournaments();
    renderMetagame();
    renderAdmin();
}
function fillSelect(id, options) {
    const element = document.getElementById(id),
        previous = element.value;
    element.innerHTML = options;
    if ([...element.options].some((option) => option.value === previous)) element.value = previous;
}
async function refreshSiteData() {
    if (dataLoading) return;
    dataLoading = true;
    document.querySelectorAll('[data-loading-icon]').forEach((icon) => {
        icon.hidden = false;
    });
    const button = document.getElementById('refreshData'),
        overviewButton = document.getElementById('overviewRetry'),
        status = document.getElementById('dataStatus');
    button.disabled = true;
    overviewButton.disabled = true;
    status.textContent = 'Carregando dados…';
    document.getElementById('overviewFeedback').hidden = false;
    document.getElementById('overviewLoadStatus').textContent = status.textContent;
    overviewButton.hidden = true;
    const controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), 60000);
    try {
        const data = await liveData.load(
            (path, options) =>
                fetch(`${window.APP_CONFIG.SUPABASE_URL}${path}`, {
                    ...options,
                    headers: window.createSupabaseHeaders()
                }),
            controller.signal
        );
        Object.assign(siteData, data);
        tournamentsData = data.events;
        const weeks = [...new Set(data.events.map((event) => liveData.weekStart(event.isoDate)))]
            .sort()
            .reverse();
        const months = [...new Set(data.events.map((event) => event.isoDate.slice(0, 7)))]
            .sort()
            .reverse();
        const periods =
            '<option value="">Todos os períodos</option>' +
            weeks
                .map(
                    (week) =>
                        `<option value="week:${week}">Semana ${liveData.displayDate(week).slice(0, 5)} — ${liveData.displayDate(liveData.weekEnd(week))}</option>`
                )
                .join('') +
            months
                .map(
                    (month) =>
                        `<option value="month:${month}">Mês ${month.slice(5)}/${month.slice(0, 4)}</option>`
                )
                .join('');
        fillSelect('dataPeriod', periods);
        if (
            ![...document.getElementById('dataPeriod').options].some(
                (option) => option.value === activePeriod
            )
        )
            activePeriod = '';
        document.getElementById('dataPeriod').value = activePeriod;
        document.getElementById('dataPeriod').disabled = false;
        document.getElementById('dataPeriod').dataset.initialized = 'true';
        const stores =
            '<option value="">Todas as lojas</option>' +
            data.stores
                .map(
                    (store) =>
                        `<option value="${escapeHtml(String(store.id))}">${escapeHtml(store.name)}</option>`
                )
                .join('');
        ['tournamentStore', 'metaStore'].forEach((id) => fillSelect(id, stores));
        const formats = [...new Set(data.events.map((event) => event.format))];
        const formatOptions = formats
            .sort((a, b) => liveData.compareFormatCodes(a, b, data.formats))
            .map(
                (format) =>
                    `<option value="${escapeHtml(format)}">${escapeHtml(liveData.formatLabel(format, data.formats))}</option>`
            )
            .join('');
        ['metaFormat', 'tournamentFormat'].forEach((id) =>
            fillSelect(id, '<option value="">Todos os formatos</option>' + formatOptions)
        );
        const previousFormat = document.getElementById('overviewFormat').value;
        fillSelect('overviewFormat', formatOptions);
        if (!formats.includes(previousFormat)) {
            const defaultFormat = data.formats.find(
                (format) => format.is_default && formats.includes(format.code)
            )?.code;
            document.getElementById('overviewFormat').value =
                defaultFormat || data.events[0]?.format || '';
        }
        document.getElementById('overviewFormat').disabled = !formats.length;
        fillSelect(
            'postTournament',
            data.events
                .filter((event) => event.winner)
                .map(
                    (event) =>
                        `<option value="${escapeHtml(event.id)}">${escapeHtml(event.store)} · ${event.date} · ${escapeHtml(event.title)}</option>`
                )
                .join('')
        );
        fillSelect(
            'postWeek',
            weeks
                .map(
                    (week) =>
                        `<option value="${week}">${liveData.displayDate(week)} — ${liveData.displayDate(liveData.weekEnd(week))}</option>`
                )
                .join('')
        );
        const postEvent = data.events.find(
            (event) => event.id === document.getElementById('postTournament').value
        );
        if (postEvent) document.getElementById('postTitle').value = postEvent.title.toUpperCase();
        renderDashboard();
        requestPostRender();
        status.textContent = `Dados atualizados · ${data.events.length} torneios cadastrados`;
        document.getElementById('overviewFeedback').hidden = true;
    } catch (error) {
        status.textContent = `${error.name === 'AbortError' ? 'O carregamento demorou demais.' : error.message} Use Atualizar dados para tentar novamente.${siteData.events.length ? ' A última consulta permanece na tela.' : ''}`;
        document.getElementById('overviewLoadStatus').textContent = status.textContent.replace(
            'Use Atualizar dados',
            'Use Tentar novamente'
        );
        overviewButton.hidden = false;
    } finally {
        clearTimeout(timeout);
        button.disabled = false;
        overviewButton.disabled = false;
        document.querySelectorAll('[data-loading-icon]').forEach((icon) => {
            icon.hidden = true;
        });
        dataLoading = false;
    }
}
function initDashboard() {
    document.getElementById('refreshData').addEventListener('click', refreshSiteData);
    document.getElementById('overviewRetry').addEventListener('click', refreshSiteData);
    document.getElementById('overviewFormat').addEventListener('change', renderDashboard);
    document.getElementById('dataPeriod').addEventListener('change', (event) => {
        activePeriod = event.target.value;
        renderDashboard();
    });
    document.getElementById('tournamentSearch').addEventListener('input', filterTournaments);
    ['tournamentStore', 'tournamentOrder', 'tournamentFormat'].forEach((id) =>
        document.getElementById(id).addEventListener('change', filterTournaments)
    );
    ['metaStore', 'metaFormat'].forEach((id) =>
        document.getElementById(id).addEventListener('change', renderMetagame)
    );
    document
        .getElementById('closeEventDialog')
        .addEventListener('click', () => document.getElementById('eventDialog').close());
    document.addEventListener('click', (event) => {
        const overviewLink = event.target.closest('[data-overview-link]');
        const overviewStore = event.target.closest('#overview [data-filter-store]');
        if (overviewLink || overviewStore) {
            const format = document.getElementById('overviewFormat').value;
            activePeriod = '';
            document.getElementById('dataPeriod').value = '';
            document.getElementById('tournamentFormat').value = format;
            document.getElementById('metaFormat').value = format;
            if (overviewLink?.dataset.overviewLink === 'tournaments') {
                document.getElementById('tournamentStore').value = '';
                document.getElementById('tournamentSearch').value = '';
            }
            if (overviewLink?.dataset.overviewLink === 'meta')
                document.getElementById('metaStore').value = '';
            filterTournaments();
            renderMetagame();
            renderAdmin();
        }
        const details = event.target.closest('[data-event-details]');
        if (details) openEventDetails(details.dataset.eventDetails);
        if (event.target.closest('[data-post-event]'))
            document.getElementById('eventDialog').close();
        const tab = event.target.closest('[data-admin-tab]');
        if (tab) switchAdminPanel(tab.dataset.adminTab);
        const analysis = event.target.closest('[data-analysis]');
        if (analysis) switchAnalysis(analysis.dataset.analysis);
        const store = event.target.closest('[data-filter-store]');
        if (store) {
            document.getElementById('tournamentStore').value = store.dataset.filterStore;
            filterTournaments();
        }
    });
    document.querySelector('.admin-tabs').addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const tabs = [...document.querySelectorAll('[data-admin-tab]')],
            current = tabs.indexOf(document.activeElement);
        const index =
            event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? tabs.length - 1
                  : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        switchAdminPanel(tabs[index].dataset.adminTab);
        tabs[index].focus();
    });
    document.querySelector('.analysis-tabs').addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const tabs = [...document.querySelectorAll('[data-analysis]')],
            current = tabs.indexOf(document.activeElement);
        const index =
            event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? tabs.length - 1
                  : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        switchAnalysis(tabs[index].dataset.analysis);
        tabs[index].focus();
    });
    document.getElementById('liveAdminLogin').addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = event.target.querySelector('button'),
            status = document.getElementById('adminStatus');
        if (button.disabled) return;
        button.disabled = true;
        status.textContent = 'Entrando…';
        try {
            await adminSession.login(document.getElementById('liveAdminPassword').value);
            document.getElementById('liveAdminPassword').value = '';
            renderAdmin();
            status.textContent = '';
        } catch (error) {
            status.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });
    document.getElementById('liveAdminLogout').addEventListener('click', async () => {
        await adminSession.logout();
        renderAdmin();
    });
    document.getElementById('adminStoreRows').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.target.closest('[data-store-edit]'),
            button = form.querySelector('button'),
            input = form.elements.storeName,
            status = form.querySelector('[role=status]');
        if (button.disabled) return;
        const name = input.value.trim();
        if (!name) {
            input.setCustomValidity('Informe o nome da loja.');
            input.reportValidity();
            return;
        }
        button.disabled = true;
        input.disabled = true;
        status.textContent = 'Salvando…';
        try {
            const saved = await adminSession.saveStore(form.dataset.storeEdit, name);
            await refreshSiteData();
            document.getElementById('adminStatus').textContent = `${saved.name}: loja salva.`;
        } catch (error) {
            status.textContent = error.message;
            if (!adminSession.session) renderAdmin();
        } finally {
            button.disabled = !adminSession.profile;
            input.disabled = !adminSession.profile;
        }
    });
    document
        .getElementById('adminStoreRows')
        .addEventListener('input', (event) => event.target.setCustomValidity(''));
    adminSession.restore().then(renderAdmin);
    return refreshSiteData();
}
