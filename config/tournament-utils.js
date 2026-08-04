(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.tournamentUtils = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    function normalizeMatchPoints(value) {
        if (value === null || value === undefined || String(value).trim() === '') return null;
        const points = Number(String(value).trim().replace(',', '.'));
        return Number.isInteger(points) && points >= 0 ? points : null;
    }

    function normalizeEntityName(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function parseDigilabTournamentId(value) {
        const raw = String(value || '').trim();
        if (/^\d+$/.test(raw)) {
            const id = Number(raw);
            return Number.isSafeInteger(id) && id > 0 ? id : null;
        }

        try {
            const url = new URL(raw);
            const host = url.hostname.toLowerCase().replace(/^www\./, '');
            const match = url.pathname.match(/^\/tournament\/(\d+)\/?$/i);
            if (host !== 'digilab.cards' || !match) return null;
            const id = Number(match[1]);
            return Number.isSafeInteger(id) && id > 0 ? id : null;
        } catch {
            return null;
        }
    }

    function getWeekdayFromIsoDate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
        if (!match) return null;
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
        return date.getUTCDay();
    }

    function findScheduledStoreId(schedule, dateValue) {
        const weekday = getWeekdayFromIsoDate(dateValue);
        if (weekday === null || !Array.isArray(schedule)) return null;
        const entry = schedule.find(
            (item) => Number(item?.weekday) === weekday && item?.is_active !== false
        );
        return entry?.store_id ? String(entry.store_id) : null;
    }

    return {
        findScheduledStoreId,
        getWeekdayFromIsoDate,
        normalizeEntityName,
        normalizeMatchPoints,
        parseDigilabTournamentId
    };
});
