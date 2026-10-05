import { useEffect, useRef, useState } from 'react';
import type { MicroContext } from '../../contracts';
import { mountReact, useData } from '../../shared/runtime';
import { renderPost, POST_FORMAT, postEventTitle } from '../../../shared/posts/renderer.js';
import { PageHeading } from '../../shared/PageHeading';
import { Select } from '../../shared/Select';
export const apiVersion = 1;
export const mount = (element: HTMLElement, context: MicroContext) =>
    mountReact(Studio, element, context);
function Studio({ context }: { context: MicroContext }) {
    const { data, loading } = useData(context.data);
    const canvas = useRef<HTMLCanvasElement>(null);
    const [template, setTemplate] = useState('podium'),
        [tournament, setTournament] = useState(''),
        [accent, setAccent] = useState('#ef646b'),
        [week, setWeek] = useState(''),
        [page, setPage] = useState(0),
        [ready, setReady] = useState(false),
        [status, setStatus] = useState('');
    const events = data.events.filter((event) => event.winner);
    const weeks = [
        ...new Set(data.events.map((event) => window.liveData.weekStart(event.isoDate)))
    ];
    const currentEvent = events.find((event) => event.id === tournament) || events[0];
    const currentWeek = week || weeks[0] || '';
    const pageCount = Math.max(
        1,
        Math.ceil(
            data.events.filter(
                (event) =>
                    event.isoDate >= currentWeek &&
                    event.isoDate <= window.liveData.weekEnd(currentWeek || '2000-01-03')
            ).length / 5
        )
    );
    useEffect(() => {
        const selected = context.route.params.get('tournament');
        if (selected) {
            setTournament(selected);
            setTemplate('podium');
        }
    }, [context.route]);
    useEffect(() => {
        let current = true;
        setReady(false);
        if (!context.active || !canvas.current || !currentEvent || !currentWeek) return;
        setStatus('Gerando prévia…');
        renderPost(
            canvas.current,
            {
                template,
                tournament: currentEvent.id,
                title: postEventTitle(currentEvent),
                accent,
                language: 'en',
                week: currentWeek,
                page: Math.min(page, pageCount - 1)
            },
            data.events,
            context.asset('icons/Symbol_of_Digital_Hazard.svg'),
            () => current
        )
            .then((result) => {
                if (current) {
                    setReady(result.ready);
                    setStatus(result.message);
                }
            })
            .catch(() => {
                if (current) setStatus('Não foi possível gerar a prévia. Tente novamente.');
            });
        return () => {
            current = false;
        };
    }, [data, context.active, template, tournament, accent, currentWeek, page, pageCount]);
    async function download() {
        if (!canvas.current || !ready) return;
        setReady(false);
        try {
            if (
                canvas.current.width !== POST_FORMAT.width ||
                canvas.current.height !== POST_FORMAT.height
            ) {
                throw Error('A prévia precisa estar em 1080 × 1350 px antes de exportar.');
            }
            const blob = await new Promise<Blob | null>((resolve) =>
                canvas.current!.toBlob(resolve, POST_FORMAT.mime)
            );
            if (!blob) throw Error('Não foi possível exportar a imagem.');
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `digimon-cwb-${template}-${template === 'weekly' ? currentWeek + '-' + (page + 1) : currentEvent?.isoDate || 'post'}.png`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setStatus('Post exportado em PNG.');
        } catch (error) {
            setStatus((error as Error).message);
        } finally {
            setReady(true);
        }
    }
    return (
        <section className="view studio-view">
            <PageHeading
                eyebrow="Compartilhe os resultados"
                title="Estúdio de posts"
                description="Crie posts com os resultados e o resumo da semana."
            />
            <div className="studio">
                <div className="studio-controls">
                    <h2>Configurar publicação</h2>
                    <fieldset className="studio-group">
                        <legend>
                            <span>01</span> Conteúdo
                        </legend>
                        <Select
                            label="Modelo"
                            value={template}
                            onChange={setTemplate}
                            options={[
                                { value: 'podium', label: 'Pódio — Top 3' },
                                { value: 'weekly', label: 'Resumo da semana' }
                            ]}
                        />
                        {template === 'podium' ? (
                            <>
                                <Select
                                    label="Torneio"
                                    value={currentEvent?.id || ''}
                                    onChange={setTournament}
                                    options={events.map((event) => ({
                                        value: event.id,
                                        label:
                                            event.store + ' · ' + event.date + ' · ' + event.title
                                    }))}
                                />
                            </>
                        ) : (
                            <>
                                <Select
                                    label="Semana"
                                    value={currentWeek}
                                    onChange={(value) => {
                                        setWeek(value);
                                        setPage(0);
                                    }}
                                    options={weeks.map((week) => ({
                                        value: week,
                                        label:
                                            window.liveData.displayDate(week) +
                                            ' — ' +
                                            window.liveData.displayDate(
                                                window.liveData.weekEnd(week)
                                            )
                                    }))}
                                />
                                {pageCount > 1 && (
                                    <Select
                                        label="Página"
                                        value={String(Math.min(page, pageCount - 1))}
                                        onChange={(value) => setPage(Number(value))}
                                        options={Array.from({ length: pageCount }, (_, index) => ({
                                            value: String(index),
                                            label: index + 1 + ' de ' + pageCount
                                        }))}
                                    />
                                )}
                            </>
                        )}
                    </fieldset>
                    <fieldset className="studio-group">
                        <legend>
                            <span>02</span> Aparência
                        </legend>
                        <Select
                            label="Cor de destaque"
                            value={accent}
                            onChange={setAccent}
                            options={[
                                { value: '#ef646b', label: 'Vermelho' },
                                { value: '#66a7f5', label: 'Azul' },
                                { value: '#4edb9b', label: 'Verde' },
                                { value: '#f1cc5b', label: 'Amarelo' }
                            ]}
                        />
                        <p className="studio-brand-note">
                            Assinatura da comunidade, Instagram e X incluídos no post.
                        </p>
                    </fieldset>
                    <section className="studio-export" aria-label="Exportação">
                        <h3>
                            <span>03</span> Exportação
                        </h3>
                        <div className="studio-export-specs">
                            <span>Instagram · Feed {POST_FORMAT.ratio}</span>
                            <strong>
                                {POST_FORMAT.width} × {POST_FORMAT.height} px · PNG
                            </strong>
                        </div>
                        <button
                            className="button primary"
                            disabled={!ready || loading}
                            onClick={() => void download()}
                        >
                            Baixar PNG ↓
                        </button>
                        <p className="muted" role="status">
                            {status}
                        </p>
                    </section>
                </div>
                <div className="post-preview">
                    <div className="preview-caption">
                        <span>PRÉVIA · FEED {POST_FORMAT.ratio}</span>
                        <span>{template === 'weekly' ? 'RESUMO SEMANAL' : 'PÓDIO / TOP 3'}</span>
                    </div>
                    <canvas
                        ref={canvas}
                        width={POST_FORMAT.width}
                        height={POST_FORMAT.height}
                        aria-label="Prévia do post gerado"
                    />
                </div>
            </div>
        </section>
    );
}
