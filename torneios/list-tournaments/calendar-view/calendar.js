(() => {
    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getAssetPrefix() {
        return window.location.pathname.includes('/torneios/list-tournaments/') ? '../../' : '';
    }

    function normalizeStoreName(name) {
        return String(name || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function resolveStoreIcon(storeName) {
        const base = `${getAssetPrefix()}icons/stores/`;
        const normalized = normalizeStoreName(storeName);
        if (normalized.includes('gladiator')) return `${base}Gladiators.png`;
        if (normalized.includes('cartinhas') || normalized.includes('celta'))
            return `${base}ReiDasCartinhas.png`;
        if (normalized.includes('meruru')) return `${base}Meruru.svg`;
        if (normalized.includes('taverna')) return `${base}Taverna.png`;
        if (normalized.includes('tcgbr') || normalized.includes('tcg br'))
            return `${base}TCGBR.png`;
        return `${base}images.png`;
    }

    function pad2(value) {
        return String(value).padStart(2, '0');
    }

    function toMonthKey(date) {
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
    }

    function getFirstOfMonth(monthKey) {
        const [year, month] = String(monthKey || '')
            .split('-')
            .map(Number);
        if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
            const now = new Date();
            return new Date(now.getFullYear(), now.getMonth(), 1);
        }
        return new Date(year, month - 1, 1);
    }

    function getMonthLabel(monthKey, monthNames) {
        const base = getFirstOfMonth(monthKey);
        return monthNames[base.getMonth()] || String(base.getMonth() + 1);
    }

    function getYearLabel(monthKey) {
        return String(getFirstOfMonth(monthKey).getFullYear());
    }

    function buildDayStoreMap(tournaments, monthKey) {
        const map = new Map();
        const keyPrefix = `${monthKey}-`;
        (tournaments || []).forEach((t) => {
            const dateStr = String(t.tournament_date || '');
            if (!dateStr.startsWith(keyPrefix)) return;
            const day = Number(dateStr.slice(8, 10));
            if (!Number.isInteger(day) || day < 1 || day > 31) return;
            if (!map.has(day)) map.set(day, []);
            const storeName = t.store && t.store.name ? String(t.store.name).trim() : 'Store';
            const tournamentName = String(t.tournament_name || 'Tournament');
            map.get(day).push({
                id: t.id || '',
                storeId: t.store_id || '',
                storeName,
                tournamentName,
                tournamentDate: dateStr,
                totalPlayers: t.total_players || ''
            });
        });
        return map;
    }

    function buildCalendarContent(monthKey, tournaments) {
        if (!monthKey) {
            return `<div class="calendar-empty-state">No tournaments for the current filters.</div>`;
        }

        const firstDay = getFirstOfMonth(monthKey);
        const year = firstDay.getFullYear();
        const month = firstDay.getMonth();
        const startWeekDay = firstDay.getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        const dayStoreMap = buildDayStoreMap(tournaments, monthKey);
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        const dayCells = [];
        for (let i = 0; i < startWeekDay; i++) {
            dayCells.push(`<div class="calendar-day is-empty"></div>`);
        }

        for (let day = 1; day <= totalDays; day++) {
            const entries = dayStoreMap.get(day) || [];
            let eventsHtml = '';
            if (entries.length === 1) {
                const item = entries[0];
                const safeStore = escapeHtml(item.storeName);
                const safeTournament = escapeHtml(item.tournamentName);
                const icon = resolveStoreIcon(item.storeName);
                eventsHtml = `
                    <div class="calendar-event"
                         data-event-payload="${encodeURIComponent(JSON.stringify(item))}"
                         title="${safeStore} - ${safeTournament}">
                        <img class="calendar-event-icon" src="${icon}" alt="${safeStore}">
                        <div class="calendar-event-text">
                            <span class="calendar-event-store">${safeStore}</span>
                            <span class="calendar-event-tournament">${safeTournament}</span>
                        </div>
                    </div>
                `;
            } else if (entries.length > 1) {
                const storeMap = new Map();
                entries.forEach((item) => {
                    const key = normalizeStoreName(item.storeName);
                    if (!storeMap.has(key)) storeMap.set(key, item);
                });
                eventsHtml = Array.from(storeMap.values())
                    .map((item) => {
                        const safeStore = escapeHtml(item.storeName);
                        const icon = resolveStoreIcon(item.storeName);
                        return `
                        <div class="calendar-event"
                             data-event-payload="${encodeURIComponent(JSON.stringify(item))}"
                             title="${safeStore}">
                            <img class="calendar-event-icon" src="${icon}" alt="${safeStore}">
                            <div class="calendar-event-text">
                                <span class="calendar-event-store">${safeStore}</span>
                            </div>
                        </div>
                    `;
                    })
                    .join('');
            }
            dayCells.push(`
                <div class="calendar-day ${entries.length ? 'has-events' : ''} is-clickable" data-day-date="${monthKey}-${pad2(day)}">
                    <div class="calendar-day-number">${day}</div>
                    <div class="calendar-events">${eventsHtml}</div>
                </div>
            `);
        }

        while (dayCells.length % 7 !== 0) {
            dayCells.push(`<div class="calendar-day is-empty"></div>`);
        }

        return `
            <div class="calendar-weekdays">
                ${weekDays.map((label) => `<div>${label}</div>`).join('')}
            </div>
            <div class="calendar-grid">
                ${dayCells.join('')}
            </div>
        `;
    }

    function render(container, options) {
        if (!container) return;
        const monthKey = options?.monthKey || '';
        const monthNames = options?.monthNames || [];
        const tournaments = options?.tournaments || [];
        const onPrev = options?.onPrev;
        const onNext = options?.onNext;
        const onPrevYear = options?.onPrevYear;
        const onNextYear = options?.onNextYear;
        const onSelectEvent = options?.onSelectEvent;
        const onSelectDay = options?.onSelectDay;
        const hasPrevMonth = Boolean(options?.hasPrevMonth);
        const hasNextMonth = Boolean(options?.hasNextMonth);
        const hasPrevYear = Boolean(options?.hasPrevYear);
        const hasNextYear = Boolean(options?.hasNextYear);

        container.innerHTML = `
            <div class="calendar-panel">
                <div class="calendar-toolbar">
                    <button type="button" class="calendar-nav-btn" id="calendarPrevBtn" aria-label="Previous month" ${hasPrevMonth ? '' : 'disabled'}>◀</button>
                    <div class="calendar-title-wrap">
                        <strong class="calendar-title">${monthKey ? getMonthLabel(monthKey, monthNames) : '-'}</strong>
                    </div>
                    <button type="button" class="calendar-nav-btn" id="calendarNextBtn" aria-label="Next month" ${hasNextMonth ? '' : 'disabled'}>▶</button>
                </div>
                <div class="calendar-year-nav">
                    <button type="button" class="calendar-nav-btn" id="calendarPrevYearBtn" aria-label="Previous year" ${hasPrevYear ? '' : 'disabled'}>◀</button>
                    <span class="calendar-year-nav-label">${monthKey ? getYearLabel(monthKey) : ''}</span>
                    <button type="button" class="calendar-nav-btn" id="calendarNextYearBtn" aria-label="Next year" ${hasNextYear ? '' : 'disabled'}>▶</button>
                </div>
                ${buildCalendarContent(monthKey, tournaments)}
            </div>
        `;

        const prevBtn = container.querySelector('#calendarPrevBtn');
        const nextBtn = container.querySelector('#calendarNextBtn');
        const prevYearBtn = container.querySelector('#calendarPrevYearBtn');
        const nextYearBtn = container.querySelector('#calendarNextYearBtn');
        const eventEls = container.querySelectorAll('.calendar-event[data-event-payload]');
        const dayEls = container.querySelectorAll('.calendar-day[data-day-date]');
        if (prevBtn && typeof onPrev === 'function') prevBtn.addEventListener('click', onPrev);
        if (nextBtn && typeof onNext === 'function') nextBtn.addEventListener('click', onNext);
        if (prevYearBtn && typeof onPrevYear === 'function')
            prevYearBtn.addEventListener('click', onPrevYear);
        if (nextYearBtn && typeof onNextYear === 'function')
            nextYearBtn.addEventListener('click', onNextYear);
        if (typeof onSelectEvent === 'function') {
            eventEls.forEach((el) => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    try {
                        const payload = JSON.parse(
                            decodeURIComponent(el.dataset.eventPayload || '')
                        );
                        onSelectEvent(payload);
                    } catch (_) {}
                });
            });
        }
        if (typeof onSelectDay === 'function') {
            dayEls.forEach((el) => {
                el.addEventListener('click', () => {
                    const date = el.dataset.dayDate || '';
                    if (date) onSelectDay(date);
                });
            });
        }
    }

    window.TournamentCalendarView = {
        render,
        toMonthKey,
        getFirstOfMonth
    };
})();
