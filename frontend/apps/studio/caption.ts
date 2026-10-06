import type { Tournament } from '../../contracts';

export function buildPodiumCaption(event: Tournament, standingsUrl = '') {
    const date = new Date(`${event.isoDate}T12:00:00Z`);
    const month = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
    ][date.getUTCMonth()];
    const medals = ['🥇', '🥈', '🥉'];
    const podium = event.podium
        .slice(0, 3)
        .flatMap((result, index) =>
            result ? [`${medals[index]} ${event.deckless ? result.name : result.deck}`] : []
        );
    const formatTag = event.format.replace(/[^a-z0-9]/gi, '');
    return [
        `🇧🇷 ${date.getUTCDate()} ${month} ${date.getUTCFullYear()} — ${event.store}`,
        `${event.format} · ${event.players} ${event.players === 1 ? 'player' : 'players'}`,
        '',
        ...podium,
        ...(standingsUrl ? ['', 'Full standings:', standingsUrl] : []),
        '',
        ['#DigimonTCG', ...(formatTag ? [`#${formatTag}`] : []), '#DigimonCWB'].join(' ')
    ].join('\n');
}

export async function loadStandingsUrl(tournamentId: string, signal: AbortSignal) {
    const params = new URLSearchParams({
        select: 'digilab_tournament_id',
        tournament_id: `eq.${tournamentId}`,
        limit: '1'
    });
    const response = await fetch(
        `${window.APP_CONFIG.SUPABASE_URL}/rest/v1/tournament_digilab_sync?${params}`,
        { headers: window.createSupabaseHeaders(), signal }
    );
    if (!response.ok) throw Error('Não foi possível consultar o link do DigiLab.');
    const rows: { digilab_tournament_id: number | string | null }[] = await response.json();
    const id = String(rows[0]?.digilab_tournament_id || '');
    return /^[1-9]\d*$/.test(id) ? `https://digimon.digilab.cards/tournament/${id}` : '';
}
