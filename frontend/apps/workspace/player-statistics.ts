import type { HistoryRecord } from './catalog-service';

export function playerStatistics(rows: HistoryRecord[]) {
    const results = [
        ...new Map(rows.map((row) => [String(row.tournament_id || row.id), row])).values()
    ];
    const ranked = results.filter((row) => Number.isFinite(row.placement) && row.placement > 0);
    const decks = new Map<string, { name: string; count: number; titles: number }>();
    for (const row of results) {
        if (!row.deck?.name) continue;
        const deck = decks.get(row.deck.name) || { name: row.deck.name, count: 0, titles: 0 };
        deck.count++;
        if (row.placement === 1) deck.titles++;
        decks.set(deck.name, deck);
    }
    const dates = results
        .map((row) => row.tournament_date)
        .filter(Boolean)
        .sort();
    return {
        events: results.length,
        titles: ranked.filter((row) => row.placement === 1).length,
        top3: ranked.filter((row) => row.placement <= 3).length,
        averagePlacement: ranked.length
            ? ranked.reduce((sum, row) => sum + row.placement, 0) / ranked.length
            : null,
        stores: new Set(results.map((row) => row.store?.name).filter(Boolean)).size,
        first: dates[0],
        recent: dates[dates.length - 1],
        decks: [...decks.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    };
}
