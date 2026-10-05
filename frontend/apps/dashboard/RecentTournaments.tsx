import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { A11y, EffectCoverflow, Keyboard } from 'swiper/modules';
import type { Swiper as SwiperInstance } from 'swiper';
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import type { Tournament } from '../../contracts';
import { RecentTournamentCard } from '../../shared/cards';
import { centeredTournamentOrder, tournamentCarouselSlides } from './overview-model';

export function RecentTournaments({
    events,
    latestTournamentId,
    onDetails
}: {
    events: Tournament[];
    latestTournamentId?: string;
    onDetails(event: Tournament): void;
}) {
    return (
        <TournamentCarousel
            key={events.map((event) => event.id).join(',')}
            events={events}
            latestTournamentId={latestTournamentId}
            onDetails={onDetails}
        />
    );
}

function TournamentCarousel({
    events,
    latestTournamentId,
    onDetails
}: {
    events: Tournament[];
    latestTournamentId?: string;
    onDetails(event: Tournament): void;
}) {
    const swiper = useRef<SwiperInstance | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [anchor, setAnchor] = useState(0);
    const reordering = useRef(false);
    const animations = useRef<Animation[]>([]);
    const pair = events.length === 2;
    const ring = events.length >= 3;
    const middle = ring ? Math.floor(events.length / 2) : 0;
    const ordered = tournamentCarouselSlides(events, anchor);
    const previousOrder = useRef(ordered.map((event) => event.id));
    const [reducedMotion, setReducedMotion] = useState(
        () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    useEffect(() => {
        const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReducedMotion(preference.matches);
        preference.addEventListener('change', update);
        return () => preference.removeEventListener('change', update);
    }, []);
    useEffect(() => () => animations.current.forEach((animation) => animation.cancel()), []);
    useLayoutEffect(() => {
        const instance = swiper.current;
        if (!ring || !instance || instance.destroyed) return;
        const ids = ordered.map((event) => event.id);
        const moved = ids.filter(
            (id, index) => Math.abs(previousOrder.current.indexOf(id) - index) > 1
        );
        reordering.current = true;
        instance.update();
        instance.slideTo(middle, 0, false);
        animations.current.forEach((animation) => animation.cancel());
        animations.current = [];
        if (!reducedMotion) {
            for (const slide of instance.slides) {
                if (!moved.includes(slide.dataset.tournamentId || '')) continue;
                const card = slide.querySelector<HTMLElement>('.recent-event-card');
                if (card)
                    animations.current.push(
                        card.animate([{ opacity: 0 }, { opacity: 0.68 }], {
                            duration: 360,
                            easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
                        })
                    );
            }
        }
        previousOrder.current = ids;
        reordering.current = false;
    }, [anchor, reducedMotion]);
    if (!events.length) return null;
    function selectTournament(index: number) {
        const instance = swiper.current;
        if (!instance) return;
        if (instance.animating) return;
        if (pair) {
            const candidates = ordered.flatMap((event, position) =>
                event.id === events[index].id ? [position] : []
            );
            const target = candidates.reduce((nearest, position) =>
                Math.abs(position - instance.realIndex) < Math.abs(nearest - instance.realIndex)
                    ? position
                    : nearest
            );
            instance.slideToLoop(target);
            return;
        }
        const position = instance.slides.findIndex(
            (slide) => slide.dataset.tournamentId === events[index].id
        );
        instance.slideTo(position);
    }
    function selectedIndex(instance: SwiperInstance) {
        const id = instance.slides[instance.activeIndex]?.dataset.tournamentId;
        return Math.max(
            0,
            events.findIndex((event) => event.id === id)
        );
    }
    return (
        <section className="overview-carousel" aria-label="Últimos torneios da semana">
            <div className="carousel-toolbar">
                {events.length > 1 && (
                    <div className="carousel-controls carousel-mobile-controls">
                        <button
                            className="icon-button"
                            aria-label="Torneio anterior"
                            aria-controls="recent-tournaments-track"
                            onClick={() => swiper.current?.slidePrev()}
                        >
                            ‹
                        </button>
                        <button
                            className="icon-button"
                            aria-label="Próximo torneio"
                            aria-controls="recent-tournaments-track"
                            onClick={() => swiper.current?.slideNext()}
                        >
                            ›
                        </button>
                    </div>
                )}
            </div>
            <Swiper
                key={events.map((event) => event.id).join(',') + ':' + reducedMotion}
                id="recent-tournaments-track"
                className="recent-tournaments-track"
                modules={[EffectCoverflow, Keyboard, A11y]}
                effect={reducedMotion ? 'slide' : 'coverflow'}
                coverflowEffect={{
                    rotate: 30,
                    stretch: -12,
                    depth: 240,
                    modifier: 1,
                    slideShadows: false
                }}
                slidesPerView="auto"
                centeredSlides
                initialSlide={middle}
                loop={pair}
                preventInteractionOnTransition
                spaceBetween={56}
                speed={reducedMotion ? 0 : 600}
                grabCursor={events.length > 1}
                watchOverflow
                keyboard={{ enabled: true, onlyInViewport: true }}
                a11y={{
                    containerRoleDescriptionMessage: 'carrossel',
                    itemRoleDescriptionMessage: 'slide',
                    slideLabelMessage: 'Torneio'
                }}
                onSwiper={(instance) => {
                    swiper.current = instance;
                    setActiveIndex(selectedIndex(instance));
                }}
                onSlideChange={(instance) => {
                    if (!reordering.current) setActiveIndex(selectedIndex(instance));
                }}
                onBeforeTransitionStart={(instance, speed) => {
                    if (!ring || reordering.current || reducedMotion || !speed) return;
                    const next = centeredTournamentOrder(events, selectedIndex(instance)).map(
                        (event) => event.id
                    );
                    animations.current.forEach((animation) => animation.cancel());
                    animations.current = [];
                    instance.slides.forEach((slide, index) => {
                        if (Math.abs(next.indexOf(slide.dataset.tournamentId || '') - index) <= 1)
                            return;
                        const card = slide.querySelector<HTMLElement>('.recent-event-card');
                        if (card)
                            animations.current.push(
                                card.animate([{ opacity: 0.68 }, { opacity: 0 }], {
                                    duration: Math.round(speed * 0.65),
                                    fill: 'forwards',
                                    easing: 'ease-in'
                                })
                            );
                    });
                }}
                onTransitionEnd={(instance) => {
                    if (ring && !reordering.current) setAnchor(selectedIndex(instance));
                }}
            >
                {ordered.map((event, index) => (
                    <SwiperSlide
                        className="carousel-slide"
                        key={pair ? `${event.id}:${index}` : event.id}
                        data-tournament-id={event.id}
                    >
                        <RecentTournamentCard
                            event={event}
                            onDetails={onDetails}
                            isLatest={event.id === latestTournamentId}
                        />
                    </SwiperSlide>
                ))}
                {events.length > 1 && (
                    <div
                        className="carousel-controls carousel-desktop-controls"
                        slot="container-end"
                    >
                        <button
                            className="icon-button"
                            aria-label="Torneio anterior"
                            aria-controls="recent-tournaments-track"
                            onClick={() => swiper.current?.slidePrev()}
                        >
                            ‹
                        </button>
                        <button
                            className="icon-button"
                            aria-label="Próximo torneio"
                            aria-controls="recent-tournaments-track"
                            onClick={() => swiper.current?.slideNext()}
                        >
                            ›
                        </button>
                    </div>
                )}
                {events.length > 1 && (
                    <div
                        className="swiper-pagination tournament-pagination"
                        slot="container-end"
                        aria-label="Selecionar torneio"
                    >
                        {events.map((event, index) => (
                            <button
                                key={event.id}
                                className={`swiper-pagination-bullet${activeIndex === index ? ' swiper-pagination-bullet-active' : ''}`}
                                aria-label={`${event.title}, ${event.date}${event.id === latestTournamentId ? ', torneio mais recente' : ''}`}
                                aria-current={activeIndex === index ? 'true' : undefined}
                                onClick={() => selectTournament(index)}
                            />
                        ))}
                    </div>
                )}
            </Swiper>
        </section>
    );
}
