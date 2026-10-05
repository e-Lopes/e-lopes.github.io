import type { MicroContext } from '../../contracts';
import { useData, Loader } from '../../shared/runtime';
import { Portrait } from '../../shared/cards';
import { analyzeMeta, currentFormat, overviewFourWeeks } from './metagame-model';
import './overview-highlights.css';
import { useMetaResults } from './useMetaResults';

export function OverviewHighlights({ context }: { context: MicroContext }) {
    const { data, updatedAt } = useData(context.data);
    const { records, loading, error, retry } = useMetaResults(context, updatedAt);
    const format = currentFormat(data.formats, data.events),
        range = overviewFourWeeks(data.events, format),
        model = analyzeMeta(range.events, records);
    const played = [...model.decks]
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 3);
    const titles = [...model.decks]
        .filter((r) => r.titles > 0)
        .sort((a, b) => b.titles - a.titles || b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 3);
    const top = [...model.decks]
        .filter((r) => r.topEligible > 0)
        .sort(
            (a, b) =>
                b.top4 / b.topEligible - a.top4 / a.topEligible ||
                b.topEligible - a.topEligible ||
                a.name.localeCompare(b.name)
        )
        .slice(0, 3);
    const columns = [
        { key: 'played', title: 'Mais jogados', rows: played },
        { key: 'titles', title: 'Mais títulos', rows: titles },
        { key: 'top4', title: 'Conversão em Top 4', rows: top }
    ];
    return (
        <section className="overview-featured overview-highlights">
            <div className="section-heading">
                <div className="overview-section-title">
                    <span className="overview-eyebrow">Metagame · últimas 4 semanas</span>
                    <h2>Decks em destaque</h2>
                </div>
                <a
                    href={context.href('meta', { format })}
                    onClick={(e) => {
                        e.preventDefault();
                        context.navigate('meta', { format });
                    }}
                >
                    Ver metagame ↗
                </a>
            </div>
            {range.start && (
                <p className="highlights-period">
                    {format} · {window.liveData.displayDate(range.start)} —{' '}
                    {window.liveData.displayDate(range.end)} · {model.known.length} participações
                    com deck identificado
                </p>
            )}
            {loading ? (
                <Loader text="Carregando destaques…" />
            ) : error ? (
                <div role="alert">
                    <p>{error}</p>
                    <button className="button secondary" onClick={retry}>
                        Tentar novamente
                    </button>
                </div>
            ) : (
                <div className="highlights-columns">
                    {columns.map((column) => (
                        <article className="highlights-column" key={column.key}>
                            <h3>
                                <span className="highlight-column-icon" aria-hidden="true">
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        {column.key === 'played' ? (
                                            <>
                                                <path d="M5 20V12M12 20V4M19 20V8" />
                                                <path d="M3 20h18" />
                                            </>
                                        ) : column.key === 'titles' ? (
                                            <>
                                                <path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8M10 18h4" />
                                            </>
                                        ) : (
                                            <>
                                                <path d="M4 18 10 12 14 15 20 5M14 5h6v6" />
                                                <path d="M4 4v16h16" />
                                            </>
                                        )}
                                    </svg>
                                </span>
                                <span>{column.title}</span>
                            </h3>
                            {column.rows.map((row, index) => {
                                const contributions = new Map<
                                    string,
                                    { name: string; count: number }
                                >();
                                for (const result of model.known.filter(
                                    (r) => r.deck_id === row.id && r.player_id && r.player
                                )) {
                                    const player = contributions.get(result.player_id!) || {
                                        name: result.player!.name,
                                        count: 0
                                    };
                                    player.count++;
                                    contributions.set(result.player_id!, player);
                                }
                                const most = Math.max(
                                    0,
                                    ...[...contributions.values()].map((p) => p.count)
                                );
                                const names = [...contributions.values()]
                                    .filter((p) => p.count === most)
                                    .map((p) => p.name)
                                    .sort();
                                const value =
                                    column.key === 'played'
                                        ? `${row.count} participações`
                                        : column.key === 'titles'
                                          ? `${row.titles} ${row.titles === 1 ? 'título' : 'títulos'}`
                                          : `${((row.top4 / row.topEligible) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% · ${row.top4} de ${row.topEligible}`;
                                return (
                                    <div
                                        className="highlight-row featured-deck-card"
                                        data-rank={index + 1}
                                        key={row.id}
                                    >
                                        <div className="featured-deck-heading">
                                            <Portrait image={row.image} />
                                            <div className="highlight-identity">
                                                <span className="featured-deck-rank">
                                                    #{index + 1}{' '}
                                                    {column.key === 'played'
                                                        ? 'MAIS JOGADO'
                                                        : column.key === 'titles'
                                                          ? 'MAIS TÍTULOS'
                                                          : 'TOP 4'}
                                                </span>
                                                <button
                                                    onClick={() =>
                                                        context.navigate('decks', {
                                                            deckId: row.id
                                                        })
                                                    }
                                                >
                                                    {row.name}
                                                </button>
                                                <strong className="highlight-value">{value}</strong>
                                            </div>
                                        </div>
                                        {names.length > 0 && (
                                            <div className="featured-deck-contributor">
                                                <span>
                                                    Maior participação
                                                    {names.length > 1 ? ' · empate' : ''}
                                                </span>
                                                <strong>{names.join(' · ')}</strong>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {!column.rows.length && (
                                <p className="highlights-empty">
                                    {column.key === 'top4'
                                        ? 'Sem participações elegíveis em torneios de 8+ jogadores.'
                                        : 'Sem resultados elegíveis neste recorte.'}
                                </p>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
