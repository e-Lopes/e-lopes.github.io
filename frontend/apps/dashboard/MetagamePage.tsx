import { useEffect, useMemo, useState } from 'react';
import { MetaProfileSummary } from './MetaProfileSummary';
import type { MicroContext } from '../../contracts';
import { useData, Loader } from '../../shared/runtime';
import { PageHeading } from '../../shared/PageHeading';
import { Select } from '../../shared/Select';
import { Portrait, Metrics } from '../../shared/cards';
import { Dialog, Pagination } from '../../shared/ListPage';
import { analyzeMeta, currentFormat, eventType } from './metagame-model';
import '../workspace/catalog.css';
import './metagame.css';
import { useMetaResults } from './useMetaResults';

const percent = (n: number, d: number) =>
    d ? `${((n / d) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—';
const monthLabel = (month: string) =>
    new Date(month + '-15T12:00:00').toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric'
    });
export function MetagamePage({ context }: { context: MicroContext }) {
    const snapshot = useData(context.data),
        { data } = snapshot;
    const { records, loading, error, retry } = useMetaResults(context, snapshot.updatedAt);
    const [historical, setHistorical] = useState(context.route.params.get('format') || ''),
        [month, setMonth] = useState(
            (context.route.params.get('period') || '').replace(/^month:/, '')
        ),
        [store, setStore] = useState(context.route.params.get('store') || ''),
        [type, setType] = useState(''),
        [tab, setTab] = useState('meta'),
        [query, setQuery] = useState(''),
        [sort, setSort] = useState('count'),
        [page, setPage] = useState(1),
        [size, setSize] = useState(20),
        [detail, setDetail] = useState('');
    useEffect(() => {
        setHistorical(context.route.params.get('format') || '');
        const p = context.route.params.get('period') || '';
        setMonth(p.startsWith('month:') ? p.slice(6) : '');
        setStore(context.route.params.get('store') || '');
    }, [context.route]);
    const current = currentFormat(data.formats, data.events),
        format = historical || current;
    const formatEvents = data.events.filter((e) => e.format === format);
    const months = [...new Set(formatEvents.map((e) => e.isoDate.slice(0, 7)))].sort().reverse();
    const base = formatEvents.filter(
        (e) => (!store || e.storeId === store) && (!type || eventType(e.title) === type)
    );
    const events = base.filter((e) => !month || e.isoDate.startsWith(month));
    const model = useMemo(
        () => analyzeMeta(events, records),
        [records, data, format, month, store, type]
    );
    useEffect(() => {
        setPage(1);
        setDetail('');
    }, [format, month, store, type, query, sort, tab, size]);
    const rows = model.decks
        .filter((r) => r.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
        .sort((a, b) => {
            const score = (r: typeof a) =>
                sort === 'titles'
                    ? r.titles
                    : sort === 'conversion'
                      ? r.eligible
                          ? r.titles / r.eligible
                          : 0
                      : r.count;
            return score(b) - score(a) || b.count - a.count || a.name.localeCompare(b.name);
        });
    const selected = model.decks.find((r) => r.id === detail);
    const lists = model.results.filter(
        (r) =>
            r.decklists?.length &&
            (!query ||
                `${r.deck?.name || ''} ${r.player?.name || ''}`
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()))
    );
    const playerRows = [...model.players]
        .filter((r) => r.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
        .sort((a, b) => b.count - a.count || b.titles - a.titles || a.name.localeCompare(b.name));
    const total =
        tab === 'meta' ? rows.length : tab === 'community' ? playerRows.length : lists.length;
    const actualPage = Math.min(page, Math.max(1, Math.ceil(total / size))),
        start = (actualPage - 1) * size;
    const go = (
        name: 'decks' | 'players' | 'builder' | 'tournaments',
        params: Record<string, string>
    ) => context.navigate(name, params);
    return (
        <section className="view metagame-view">
            <PageHeading
                eyebrow={
                    historical && historical !== current ? 'Histórico de formatos' : 'Cenário atual'
                }
                title="Metagame"
                description="O que a comunidade joga e como os decks se saem nos torneios."
            />
            <div className="meta-controls">
                <div className="meta-format-heading">
                    <div>
                        <span className="overview-eyebrow">
                            {historical && historical !== current
                                ? 'Formato histórico'
                                : 'Formato atual'}
                        </span>
                        <h2>{window.liveData.formatLabel(format, data.formats)}</h2>
                    </div>
                    <Select
                        label="Formato"
                        value={format}
                        onChange={(v) => {
                            setHistorical(v);
                            setMonth('');
                        }}
                        options={[
                            ...(current
                                ? [
                                      {
                                          value: current,
                                          label: `Atual · ${window.liveData.formatLabel(current, data.formats)}`
                                      }
                                  ]
                                : []),
                            ...data.formats
                                .filter(
                                    (f) =>
                                        f.code !== current &&
                                        data.events.some((e) => e.format === f.code)
                                )
                                .map((f) => ({
                                    value: f.code,
                                    label: window.liveData.formatLabel(f.code, data.formats)
                                }))
                        ]}
                    />
                </div>
                <div className="meta-filters">
                    <Select
                        label="Período"
                        value={month}
                        onChange={setMonth}
                        options={[
                            { value: '', label: 'Todo o formato' },
                            ...months.map((m) => ({ value: m, label: monthLabel(m) }))
                        ]}
                    />
                    <Select
                        label="Loja"
                        value={store}
                        onChange={setStore}
                        options={[
                            { value: '', label: 'Todas as lojas' },
                            ...data.stores.map((s) => ({ value: String(s.id), label: s.name }))
                        ]}
                    />
                    <Select
                        label="Tipo de evento"
                        value={type}
                        onChange={setType}
                        options={[
                            { value: '', label: 'Todos os tipos' },
                            ...[...new Set(formatEvents.map((e) => eventType(e.title)))]
                                .sort()
                                .map((t) => ({ value: t, label: t }))
                        ]}
                    />
                </div>
            </div>
            {snapshot.error && <p role="alert">{snapshot.error}</p>}
            {loading ? (
                <Loader text="Analisando resultados…" />
            ) : error ? (
                <div role="alert">
                    <p>{error}</p>
                    <button className="button secondary" onClick={retry}>
                        Tentar novamente
                    </button>
                </div>
            ) : (
                <>
                    <Metrics
                        rows={[
                            [
                                'Torneios',
                                events.length,
                                month ? monthLabel(month) : 'Todo o formato'
                            ],
                            [
                                'Participações',
                                model.results.length,
                                `${model.players.length} jogadores distintos`
                            ],
                            [
                                'Decks identificados',
                                model.decks.length,
                                `${model.known.length} participações com deck`
                            ]
                        ]}
                    />
                    <p className="meta-coverage meta-record-coverage">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
                            <path d="m9 12 2 2 4-4" />
                        </svg>
                        <span>
                            {model.complete.size} de {events.length} torneios com classificação
                            completa · decks identificados em {model.known.length} de{' '}
                            {model.deckExpected} participações elegíveis. Eventos sem deck ficam
                            fora da análise de metagame.
                        </span>
                    </p>
                    <div className="analysis-tabs" aria-label="Análises">
                        {[
                            ['meta', 'Metagame'],
                            ['community', 'Comunidade'],
                            ['lists', 'Decklists']
                        ].map(([value, label]) => (
                            <button
                                key={value}
                                aria-pressed={tab === value}
                                onClick={() => {
                                    setTab(value);
                                    setQuery('');
                                }}
                            >
                                {label}
                                <span className="meta-tab-count">
                                    {value === 'meta'
                                        ? model.decks.length
                                        : value === 'community'
                                          ? model.players.length
                                          : model.results.filter((r) => r.decklists?.length).length}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="meta-table-tools">
                        <label>
                            Buscar{' '}
                            {tab === 'community'
                                ? 'jogador'
                                : tab === 'lists'
                                  ? 'deck ou jogador'
                                  : 'deck'}
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Buscar na análise"
                            />
                        </label>
                        {tab === 'meta' && (
                            <Select
                                label="Ordenar"
                                value={sort}
                                onChange={setSort}
                                options={[
                                    { value: 'count', label: 'Mais utilizados' },
                                    { value: 'titles', label: 'Mais títulos' },
                                    { value: 'conversion', label: 'Conversão em títulos' }
                                ]}
                            />
                        )}
                    </div>
                    {tab === 'meta' ? (
                        <div className="meta-table-scroll">
                            <table className="meta-results-table meta-deck-table">
                                <colgroup>
                                    <col className="meta-col-deck" />
                                    <col className="meta-col-share" />
                                    <col />
                                    <col />
                                    <col />
                                    <col />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>Deck</th>
                                        <th aria-sort={sort === 'count' ? 'descending' : 'none'}>
                                            <button
                                                className="meta-sort-button"
                                                onClick={() => setSort('count')}
                                            >
                                                Participações {sort === 'count' ? '↓' : ''}
                                            </button>
                                        </th>
                                        <th>Jogadores</th>
                                        <th aria-sort={sort === 'titles' ? 'descending' : 'none'}>
                                            <button
                                                className="meta-sort-button"
                                                onClick={() => setSort('titles')}
                                            >
                                                Títulos {sort === 'titles' ? '↓' : ''}
                                            </button>
                                        </th>
                                        <th
                                            aria-sort={
                                                sort === 'conversion' ? 'descending' : 'none'
                                            }
                                        >
                                            <button
                                                className="meta-sort-button"
                                                onClick={() => setSort('conversion')}
                                            >
                                                Taxa de títulos {sort === 'conversion' ? '↓' : ''}
                                            </button>
                                        </th>
                                        <th title="Somente torneios completos com pelo menos 8 participantes">
                                            Top 4 <small>8+ players</small>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.slice(start, start + size).map((r, index) => (
                                        <tr key={r.id}>
                                            <th>
                                                <button
                                                    className="meta-deck-button"
                                                    onClick={() => setDetail(r.id)}
                                                >
                                                    <span className="meta-row-number">
                                                        {String(start + index + 1).padStart(2, '0')}
                                                    </span>
                                                    <Portrait image={r.image} />
                                                    <span>{r.name}</span>
                                                </button>
                                            </th>
                                            <td>
                                                <strong>{r.count}</strong>
                                                <span>
                                                    {percent(r.count, model.known.length)} do meta
                                                </span>
                                                <div className="meta-share-bar">
                                                    <i
                                                        style={{
                                                            width: `${model.known.length ? (r.count / model.known.length) * 100 : 0}%`
                                                        }}
                                                    />
                                                </div>
                                            </td>
                                            <td>{r.players.size}</td>
                                            <td>
                                                <span
                                                    className={`meta-title-count${r.titles ? ' has-titles' : ''}`}
                                                >
                                                    {r.titles}
                                                </span>
                                            </td>
                                            <td>
                                                {percent(r.titles, r.eligible)}
                                                <span>
                                                    {r.titles} de {r.eligible}
                                                </span>
                                            </td>
                                            <td>
                                                {percent(r.top4, r.topEligible)}
                                                <span>
                                                    {r.top4} de {r.topEligible}
                                                </span>
                                                {r.topEligible > 0 && r.topEligible < 5 && (
                                                    <small className="meta-small-sample">
                                                        Amostra pequena
                                                    </small>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : tab === 'community' ? (
                        <>
                            <div className="meta-months">
                                <h2>Atividade da comunidade</h2>
                                {months
                                    .slice()
                                    .reverse()
                                    .map((m) => {
                                        const es = base.filter((e) => e.isoDate.startsWith(m));
                                        return (
                                            <div key={m}>
                                                <strong>{monthLabel(m)}</strong>
                                                <span>
                                                    {es.length} torneios ·{' '}
                                                    {es.reduce((s, e) => s + e.players, 0)}{' '}
                                                    participações · média{' '}
                                                    {es.length
                                                        ? (
                                                              es.reduce(
                                                                  (s, e) => s + e.players,
                                                                  0
                                                              ) / es.length
                                                          ).toFixed(1)
                                                        : '—'}{' '}
                                                    por torneio
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                            <div className="meta-table-scroll">
                                <table className="meta-results-table">
                                    <thead>
                                        <tr>
                                            <th>Jogador</th>
                                            <th>Participações</th>
                                            <th>Títulos</th>
                                            <th>Último evento</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {playerRows.slice(start, start + size).map((r) => (
                                            <tr key={r.id}>
                                                <th>
                                                    <button
                                                        className="meta-text-button"
                                                        onClick={() =>
                                                            go('players', { playerId: r.id })
                                                        }
                                                    >
                                                        {r.name}
                                                    </button>
                                                </th>
                                                <td>{r.count}</td>
                                                <td>{r.titles}</td>
                                                <td>{window.liveData.displayDate(r.last)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="meta-coverage">
                                Listas registradas neste recorte. Esta amostra não representa todas
                                as participações do formato.
                            </p>
                            <div className="meta-list-cards">
                                {lists.slice(start, start + size).map((r) => (
                                    <button
                                        key={r.id}
                                        onClick={() =>
                                            go('builder', { resultId: r.id, returnView: 'meta' })
                                        }
                                    >
                                        <strong>{r.deck?.name || 'Deck não informado'}</strong>
                                        <span>
                                            {r.player?.name || 'Jogador não informado'} ·{' '}
                                            {r.placement}º lugar
                                        </span>
                                        <span>
                                            {
                                                events.find((e) => e.id === String(r.tournament_id))
                                                    ?.date
                                            }{' '}
                                            · Abrir lista ↗
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                    {!total && (
                        <p className="meta-empty">Nenhum registro encontrado neste recorte.</p>
                    )}
                    {!!total && (
                        <Pagination
                            page={actualPage}
                            pages={Math.max(1, Math.ceil(total / size))}
                            size={size}
                            total={total}
                            onPage={setPage}
                            onSize={setSize}
                        />
                    )}
                    <details className="meta-methodology">
                        <summary>Como interpretar os dados</summary>
                        <p>
                            Popularidade conta participações com deck identificado. Conversão é a
                            proporção de participações que terminaram em título, somente em
                            classificações completas. Top 4 considera torneios completos com pelo
                            menos 8 participantes. As taxas sempre mostram sua base; uma amostra
                            pequena exige cautela. Participações e jogadores únicos são medidas
                            diferentes. Não calculamos taxa de vitória por partida ou matchups
                            porque os registros não incluem confrontos individuais.
                        </p>
                    </details>
                    {selected && (
                        <Dialog title={selected.name} wide onClose={() => setDetail('')}>
                            <MetaProfileSummary
                                count={selected.count}
                                share={percent(selected.count, model.known.length)}
                                players={selected.players.size}
                                titles={selected.titles}
                            />
                            <button
                                className="button secondary"
                                onClick={() => go('decks', { deckId: selected.id })}
                            >
                                Ver deck ↗
                            </button>
                            <div className="meta-months">
                                <h3>Evolução mensal no formato</h3>
                                {months
                                    .slice()
                                    .reverse()
                                    .map((m) => {
                                        const a = analyzeMeta(
                                            base.filter((e) => e.isoDate.startsWith(m)),
                                            records
                                        );
                                        const r = a.decks.find((d) => d.id === selected.id);
                                        return (
                                            <div key={m}>
                                                <strong>{monthLabel(m)}</strong>
                                                <span>
                                                    {r?.count || 0} participações ·{' '}
                                                    {percent(r?.count || 0, a.known.length)} do meta
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                            <h3>Resultados recentes</h3>
                            <div className="meta-detail-results">
                                {model.known
                                    .filter((r) => r.deck_id === selected.id)
                                    .sort((a, b) =>
                                        (
                                            events.find((e) => e.id === String(b.tournament_id))
                                                ?.isoDate || ''
                                        ).localeCompare(
                                            events.find((e) => e.id === String(a.tournament_id))
                                                ?.isoDate || ''
                                        )
                                    )
                                    .slice(0, 20)
                                    .map((r) => (
                                        <button
                                            key={r.id}
                                            onClick={() =>
                                                go('tournaments', {
                                                    tournament: String(r.tournament_id)
                                                })
                                            }
                                        >
                                            <strong>
                                                {r.player?.name || 'Jogador não informado'}
                                            </strong>
                                            <span>
                                                {r.placement}º ·{' '}
                                                {
                                                    events.find(
                                                        (e) => e.id === String(r.tournament_id)
                                                    )?.date
                                                }{' '}
                                                ·{' '}
                                                {
                                                    events.find(
                                                        (e) => e.id === String(r.tournament_id)
                                                    )?.store
                                                }
                                            </span>
                                        </button>
                                    ))}
                            </div>
                        </Dialog>
                    )}
                </>
            )}
        </section>
    );
}
