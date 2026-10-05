'use strict';

let tournamentsData = [];
function weeklyEvents() {
    const start = document.getElementById('postWeek').value;
    if (!start) return [];
    const end = liveData.weekEnd(start);
    return tournamentsData
        .filter((event) => event.isoDate >= start && event.isoDate <= end)
        .sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.id.localeCompare(b.id));
}
const postCanvas = document.getElementById('postCanvas');
const postContext = postCanvas.getContext('2d');
const imageCache = new Map();
let postRenderVersion = 0;
let postRenderPromise = Promise.resolve();
let renderedPostVersion = 0;

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function showView() {
    const labels = {
        overview: 'Visão geral',
        tournaments: 'Torneios',
        meta: 'Estatísticas / Metagame',
        posts: 'Estúdio de posts',
        admin: 'Admin',
        decks: 'Decks',
        players: 'Jogadores',
        integration: 'DigiLab e ferramentas',
        manage: 'Gerenciar torneios',
        statistics: 'Mais estatísticas'
    };
    const requested = window.location.hash.slice(1);
    const active = Object.hasOwn(labels, requested) ? requested : 'overview';
    const workspaceView = Object.hasOwn(workspaceRoutes, active);
    if (workspaceView) {
        openWorkspace(active);
        return;
    }
    document.querySelectorAll('.view').forEach((section) => {
        section.hidden = section.id !== active;
    });
    document.querySelectorAll('[data-view]').forEach((link) => {
        if (
            link.dataset.view === active ||
            (active === 'integration' && link.dataset.view === 'admin') ||
            (active === 'manage' && link.dataset.view === 'tournaments') ||
            (active === 'statistics' && link.dataset.view === 'meta')
        )
            link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
    document.getElementById('pageLabel').textContent = labels[active];
    window.sectionNavigation?.setCurrent(active);
    document.querySelector('.data-toolbar').hidden = active === 'overview' || active === 'posts';
    document.title = `DigiStats — ${labels[active]}`;
    requestAnimationFrame(() => window.scrollTo(0, 0));
}

function loadPostImage(src) {
    if (!src) return Promise.resolve(null);
    if (imageCache.has(src)) return imageCache.get(src);
    const promise = new Promise((resolve) => {
        const image = new Image();
        const timeout = setTimeout(() => {
            image.src = '';
            resolve(null);
        }, 15000);
        image.crossOrigin = 'anonymous';
        image.onload = () => {
            clearTimeout(timeout);
            resolve(image);
        };
        image.onerror = () => {
            clearTimeout(timeout);
            imageCache.delete(src);
            resolve(null);
        };
        image.src = src;
    });
    imageCache.set(src, promise);
    return promise;
}

function fitPostText(ctx, text, maxWidth, initialSize, weight = 800, minimum = 22) {
    let size = initialSize;
    do {
        ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
        if (ctx.measureText(text).width <= maxWidth || size <= minimum) break;
        size -= 2;
    } while (size > 0);
    return size;
}

function paintHazard(ctx, image, x, y, size, color, opacity = 1) {
    if (!image) return;
    const tint = document.createElement('canvas');
    tint.width = 560;
    tint.height = 560;
    const buffer = tint.getContext('2d');
    buffer.drawImage(image, 0, 0, 560, 560);
    buffer.globalCompositeOperation = 'source-in';
    buffer.fillStyle = color;
    buffer.fillRect(0, 0, 560, 560);
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(x + size / 2, y + size / 2);
    ctx.drawImage(tint, -size / 2, -size / 2, size, size);
    ctx.restore();
}

function paintPortrait(ctx, image, x, y, radius, color, initials) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#1d3027';
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    if (image) {
        // Match Decks: width: 100%, scale(2.3), transform-origin: center 20%.
        const zoom = 2.3;
        const baseScale = (radius * 2) / image.width;
        const baseHeight = image.height * baseScale;
        const width = radius * 2 * zoom,
            height = baseHeight * zoom;
        const top = y - radius - baseHeight * 0.2 * (zoom - 1);
        ctx.drawImage(image, x - width / 2, top, width, height);
    } else {
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.font = `800 ${radius * 0.45}px Arial`;
        ctx.fillText(initials, x, y + radius * 0.15);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.stroke();
}

function postFooter(ctx, hazard, accent) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(64, 1164);
    ctx.lineTo(1016, 1164);
    ctx.stroke();
    ctx.restore();
    paintHazard(ctx, hazard, 80, 1200, 76, accent);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px Arial';
    ctx.fillText('DIGISTATS', 300, 1232);
    ctx.fillStyle = '#aab1b5';
    ctx.font = '500 24px Arial';
    ctx.fillText('DIGIMON CARD GAME', 300, 1265);
    ctx.fillStyle = accent;
    ctx.font = '700 28px Arial';
    ctx.fillText('CURITIBA / PR', 820, 1232);
    ctx.font = '500 24px Arial';
    const handle = '@digimoncwb';
    const iconSize = 26,
        gap = 12;
    const socialWidth = iconSize + gap + ctx.measureText(handle).width;
    const socialLeft = 820 - socialWidth / 2;
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(socialLeft, 1243, iconSize, iconSize, 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(socialLeft + 13, 1256, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(socialLeft + 20, 1249, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#b9bec2';
    ctx.fillText(handle, socialLeft + iconSize + gap, 1265);
}

function paintStoreLogo(ctx, image, x, y, width, height) {
    if (!image) return;
    const scale = Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * scale,
        drawHeight = image.height * scale;
    ctx.drawImage(
        image,
        x + (width - drawWidth) / 2,
        y + (height - drawHeight) / 2,
        drawWidth,
        drawHeight
    );
}

function paintPodiumIdentity(ctx, player, portrait, isWinner) {
    const top = portrait.textY - 20;
    ctx.textAlign = 'center';
    ctx.fillStyle = portrait.color;
    const deckName = player.deck.toUpperCase();
    fitPostText(ctx, deckName, portrait.width, isWinner ? 36 : 29, 800);
    ctx.fillText(deckName, portrait.x, top + 38, portrait.width);
    ctx.fillStyle = '#e0e3e5';
    fitPostText(ctx, player.name, portrait.width, isWinner ? 29 : 27, 500, 20);
    ctx.fillText(player.name, portrait.x, top + 74, portrait.width);
}

function paintPodium(ctx, event, title, images, hazard, accent, storeLogo) {
    const winnerCenter = { x: 540, y: 665 };
    const watermarkSize = 1100;
    // Align the symbol's central ring (137, 128 in the 274-square viewBox),
    // rather than the center of its asymmetric overall bounding box.
    paintHazard(
        ctx,
        hazard,
        winnerCenter.x - (watermarkSize * 137) / 274,
        winnerCenter.y - (watermarkSize * 128) / 274,
        watermarkSize,
        accent,
        0.16
    );
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    const words = title.trim().toUpperCase().split(/\s+/);
    const lines = [];
    let current = '';
    ctx.font = '900 68px Arial';
    words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (ctx.measureText(candidate).width > 510 && current) {
            lines.push(current);
            current = word;
        } else current = candidate;
    });
    if (current) lines.push(current);
    lines.slice(0, 3).forEach((line, index) => {
        fitPostText(ctx, line, 510, 68);
        if (index === 0) {
            const bounds = ctx.measureText(line);
            const titleCenterY =
                112 + (bounds.actualBoundingBoxDescent - bounds.actualBoundingBoxAscent) / 2;
            paintHazard(ctx, hazard, 52, titleCenterY - 39, 78, accent);
        }
        ctx.fillText(line, 158, 112 + index * 76, 510);
    });
    const metadataY = 112 + Math.min(lines.length, 3) * 76;
    ctx.font = '700 34px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(event.date.slice(0, 5), 66, metadataY);
    ctx.fillStyle = accent;
    fitPostText(ctx, `· ${event.players} JOGADORES · ${event.format}`, 610, 32, 700);
    ctx.fillText(`· ${event.players} JOGADORES · ${event.format}`, 190, metadataY, 610);
    paintStoreLogo(ctx, storeLogo, 728, 50, 280, 144);
    const portraits = [
        {
            ...winnerCenter,
            radius: 185,
            label: 'WINNER',
            color: '#e2bb68',
            labelY: 425,
            textY: 888,
            width: 390
        },
        {
            x: 202,
            y: 868,
            radius: 125,
            label: '2nd',
            color: '#c8ced5',
            labelY: 693,
            textY: 1027,
            width: 300
        },
        {
            x: 878,
            y: 868,
            radius: 125,
            label: '3rd',
            color: '#cb7b43',
            labelY: 693,
            textY: 1027,
            width: 300
        }
    ];
    portraits.forEach((portrait, index) => {
        const player = event.podium[index] || { deck: '—', name: 'Resultado não registrado' };
        ctx.textAlign = 'center';
        ctx.fillStyle = portrait.color;
        ctx.font = `900 ${index === 0 ? 75 : 64}px Arial`;
        ctx.fillText(portrait.label, portrait.x, portrait.labelY);
        if (!event.deckless)
            paintPortrait(
                ctx,
                images[index],
                portrait.x,
                portrait.y,
                portrait.radius,
                portrait.color,
                player.deck.slice(0, 2).toUpperCase()
            );
        if (event.deckless) {
            ctx.fillStyle = portrait.color;
            fitPostText(ctx, player.name, portrait.width, index === 0 ? 38 : 30, 800, 24);
            ctx.fillText(player.name, portrait.x, portrait.labelY + 85, portrait.width);
        } else paintPodiumIdentity(ctx, player, portrait, index === 0);
    });
    postFooter(ctx, hazard, accent);
}

function paintWeekly(ctx, hazard, accent, images, storeLogos, events, weekEvents) {
    paintHazard(ctx, hazard, 52, 64, 78, accent);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 46px Arial';
    ctx.fillText('RESUMO DA', 158, 106);
    ctx.fillText('SEMANA', 158, 163);
    ctx.textAlign = 'right';
    ctx.fillStyle = accent;
    ctx.font = '800 36px Arial';
    const start = document.getElementById('postWeek').value;
    ctx.fillText(
        `${liveData.displayDate(start).slice(0, 5)} — ${liveData.displayDate(liveData.weekEnd(start)).slice(0, 5)}`,
        1008,
        112
    );
    ctx.font = '700 24px Arial';
    ctx.fillStyle = '#b9bec2';
    ctx.fillText('CURITIBA · PR', 1008, 153);
    const columns = [
        { label: 'DIA', x: 118, align: 'center' },
        { label: 'DECK / JOGADOR', x: 350, align: 'left' },
        { label: 'LOJA', x: 902, align: 'center' }
    ];
    ctx.fillStyle = accent;
    ctx.font = '700 26px Arial';
    columns.forEach(({ label, x, align }) => {
        ctx.textAlign = align;
        ctx.fillText(label, x, 268);
    });
    const pageCount = Math.ceil(weekEvents.length / 5);
    if (pageCount > 1) {
        ctx.font = '500 24px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(
            `PÁGINA ${Number(document.getElementById('postPage').value) + 1} / ${pageCount}`,
            1008,
            197
        );
    }
    events.forEach((event, index) => {
        const winner = event.winner || { deck: 'Resultado não registrado', name: '', image: '' };
        const y = 300 + index * 142;
        ctx.fillStyle = '#1b1e21';
        ctx.beginPath();
        ctx.roundRect(52, y, 976, 126, 24);
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 32px Arial';
        ctx.fillText(event.day, 118, y + 54);
        ctx.fillStyle = '#b9bec2';
        ctx.font = '700 26px Arial';
        ctx.fillText(event.date.slice(0, 5), 118, y + 89);
        if (!event.deckless)
            paintPortrait(ctx, images[index], 260, y + 63, 49, accent, winner.deck.slice(0, 2));
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        if (event.deckless) {
            fitPostText(ctx, winner.name, 590, 34, 800, 24);
            ctx.fillText(winner.name, 205, y + 72, 590);
        } else {
            fitPostText(ctx, winner.deck, 420, 34, 800, 24);
            ctx.fillText(winner.deck, 350, y + 54, 420);
            ctx.fillStyle = '#c7cbd0';
            fitPostText(ctx, winner.name, 420, 29, 500, 24);
            ctx.fillText(winner.name, 350, y + 92, 420);
        }
        ctx.textAlign = 'center';
        paintStoreLogo(ctx, storeLogos[index], 814, y + 15, 176, 96);
        if (!storeLogos[index]) {
            ctx.fillStyle = accent;
            fitPostText(ctx, event.store.toUpperCase(), 172, 24, 800, 18);
            ctx.fillText(event.store.toUpperCase(), 902, y + 72, 172);
        }
    });
    const totals = [
        { value: weekEvents.length, label: 'TORNEIOS' },
        {
            value: weekEvents.reduce((sum, event) => sum + event.players, 0),
            label: 'PARTICIPAÇÕES'
        },
        {
            value: [...new Set(weekEvents.map((event) => event.format))].join(' / '),
            label: 'FORMATO'
        }
    ];
    totals.forEach(({ value, label }, index) => {
        const x = 214 + index * 326;
        ctx.textAlign = 'center';
        ctx.fillStyle = accent;
        fitPostText(ctx, String(value), 290, 42, 800, 24);
        ctx.fillText(String(value), x, 1120, 290);
        ctx.fillStyle = '#c0c5ca';
        ctx.font = '700 24px Arial';
        ctx.fillText(label, x, 1067);
    });
    postFooter(ctx, hazard, accent);
}

function requestPostRender() {
    const version = ++postRenderVersion;
    const template = document.getElementById('postTemplate').value;
    const event =
        tournamentsData.find(
            (item) => item.id === document.getElementById('postTournament').value
        ) || tournamentsData[0];
    const title = document.getElementById('postTitle').value.trim() || event?.title || '';
    const weekEvents = weeklyEvents();
    const pages = Math.max(1, Math.ceil(weekEvents.length / 5));
    const previousPage = Number(document.getElementById('postPage').value) || 0;
    document.getElementById('postPage').innerHTML = Array.from(
        { length: pages },
        (_, index) => `<option value="${index}">${index + 1} de ${pages}</option>`
    ).join('');
    document.getElementById('postPage').value = String(Math.min(previousPage, pages - 1));
    const page = Number(document.getElementById('postPage').value);
    const weeklyRows = weekEvents.slice(page * 5, page * 5 + 5);
    document.getElementById('postWeekLabel').hidden = template !== 'weekly';
    document.getElementById('postPageLabel').hidden = template !== 'weekly' || pages < 2;
    document.getElementById('downloadPost').disabled = true;
    const accent = document.getElementById('postAccent').value;
    document.getElementById('postTournamentLabel').hidden = template === 'weekly';
    document.getElementById('postTitleLabel').hidden = template === 'weekly';
    document.getElementById('previewType').textContent =
        template === 'weekly' ? 'RESUMO SEMANAL' : 'PÓDIO / TOP 3';
    postRenderPromise = (async () => {
        if (
            (template === 'weekly' && !weeklyRows.length) ||
            (template !== 'weekly' && !event?.winner)
        ) {
            postContext.clearRect(0, 0, 1080, 1350);
            document.getElementById('postStatus').textContent =
                'Nenhum resultado disponível para este modelo.';
            return;
        }
        const sources =
            template === 'weekly'
                ? weeklyRows.map((item) => item.winner?.image || '')
                : event.podium.map((player) => player?.image || '');
        const events = template === 'weekly' ? weeklyRows : [event];
        const [hazard, images, storeLogos] = await Promise.all([
            loadPostImage('../icons/Symbol_of_Digital_Hazard.svg'),
            Promise.all(sources.map(loadPostImage)),
            Promise.all(events.map((item) => loadPostImage(item.logo)))
        ]);
        if (version !== postRenderVersion) return;
        postContext.clearRect(0, 0, 1080, 1350);
        postContext.fillStyle = '#242629';
        postContext.fillRect(0, 0, 1080, 1350);
        postContext.textBaseline = 'alphabetic';
        if (template === 'weekly')
            paintWeekly(postContext, hazard, accent, images, storeLogos, weeklyRows, weekEvents);
        else paintPodium(postContext, event, title, images, hazard, accent, storeLogos[0]);
        renderedPostVersion = version;
        document.getElementById('downloadPost').disabled = false;
        const missing =
            images.some(
                (image, index) =>
                    !image && !(template === 'weekly' ? weeklyRows[index].deckless : event.deckless)
            ) ||
            storeLogos.some((image) => !image) ||
            !hazard;
        document.getElementById('postStatus').textContent = missing
            ? 'Algumas imagens não carregaram. Confira a prévia antes de baixar.'
            : 'Prévia pronta para exportar.';
    })().catch(() => {
        if (version !== postRenderVersion) return;
        document.getElementById('postStatus').textContent =
            'Não foi possível gerar a prévia. Tente trocar o modelo.';
    });
}

async function downloadPost() {
    const button = document.getElementById('downloadPost');
    if (button.disabled) return;
    button.disabled = true;
    try {
        // A newer input can arrive while assets are loading; always export the latest render.
        while (true) {
            const pending = postRenderPromise;
            await pending;
            if (pending === postRenderPromise) break;
        }
        if (renderedPostVersion !== postRenderVersion)
            throw new Error('A prévia ainda não está pronta.');
        const blob = await new Promise((resolve) => postCanvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('Não foi possível exportar a imagem.');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `digistats-v2-${document.getElementById('postTemplate').value}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        document.getElementById('postStatus').textContent = 'Post exportado em PNG.';
    } catch (error) {
        document.getElementById('postStatus').textContent = error.message;
    } finally {
        button.disabled = renderedPostVersion !== postRenderVersion;
    }
}

function initSite() {
    initWorkspace();
    window.siteReady = initDashboard();
    document.addEventListener('click', (event) => {
        const link = event.target.closest('[data-post-event]');
        if (!link) return;
        const tournament = tournamentsData.find((item) => item.id === link.dataset.postEvent);
        document.getElementById('postTournament').value = tournament.id;
        document.getElementById('postTemplate').value = 'podium';
        document.getElementById('postTitle').value = tournament.title.toUpperCase();
        requestPostRender();
    });
    ['postTemplate', 'postTitle', 'postAccent', 'postPage'].forEach((id) =>
        document.getElementById(id).addEventListener('input', requestPostRender)
    );
    document.getElementById('postWeek').addEventListener('change', () => {
        document.getElementById('postPage').value = '0';
        requestPostRender();
    });
    document.getElementById('postTournament').addEventListener('change', () => {
        const event = tournamentsData.find(
            (item) => item.id === document.getElementById('postTournament').value
        );
        if (!event) return;
        document.getElementById('postTitle').value = event.title.toUpperCase();
        requestPostRender();
    });
    document.getElementById('downloadPost').addEventListener('click', downloadPost);
    window.addEventListener('hashchange', showView);
    showView();
    requestPostRender();
}

initSite();
