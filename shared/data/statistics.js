(function (root) {
    'use strict';
    function analyze(events) {
        const decks = new Map(),
            players = new Map();
        const add = (map, key, image, result, hasWinner) => {
            if (!map.has(key))
                map.set(key, { name: key, image, count: 0, titles: 0, top3: 0, eligible: 0 });
            const row = map.get(key);
            row.count++;
            if (!row.image) row.image = image;
            if (result.placement === 1) row.titles++;
            if (result.placement >= 1 && result.placement <= 3) row.top3++;
            if (hasWinner) row.eligible++;
        };
        events.forEach((event) => {
            const hasWinner = event.results.some((result) => result.placement === 1);
            event.results.forEach((result) => {
                if (!event.deckless) add(decks, result.deck, result.image, result, hasWinner);
                add(players, result.name, result.image, result, hasWinner);
            });
        });
        const sort = (rows) =>
            [...rows.values()].sort(
                (a, b) =>
                    b.titles - a.titles ||
                    b.top3 - a.top3 ||
                    b.count - a.count ||
                    a.name.localeCompare(b.name)
            );
        return { decks: sort(decks), players: sort(players) };
    }
    const api = { analyze };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.resultStatistics = api;
})(typeof window !== 'undefined' ? window : globalThis);
