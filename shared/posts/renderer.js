// Shared canvas renderer: the approved v2 design, independent of the editor UI.
export const POST_FORMAT = Object.freeze({
    width: 1080,
    height: 1350,
    ratio: '4:5',
    mime: 'image/png'
});
const imageCache = new Map();
export function postEventTitle(event) {
    const title = String(event?.title || '').trim();
    const key = title.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    const types = {
        locals: 'Locals',
        local: 'Locals',
        semanal: 'Locals',
        weekly: 'Locals',
        online: 'Online',
        'evo cup': 'Evo Cup',
        'store championship': 'Store Championship',
        'regulation battle': 'Regulation Battle',
        'release event': 'Release Event'
    };
    return types[key] || title;
}
const liveData = {
    displayDate: (date) => {
        const [, month, day] = date.split('-');
        const months = [
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
        ];
        return `${day}/${months[Number(month) - 1]}`;
    },
    weekEnd: (start) => {
        const date = new Date(start + 'T12:00:00Z');
        date.setUTCDate(date.getUTCDate() + 6);
        return date.toISOString().slice(0, 10);
    }
};
function loadPostImage(src) {
    if (!src) return Promise.resolve(null);
    if (imageCache.has(src)) return imageCache.get(src);
    const promise = new Promise((resolve) => {
        const image = new Image();
        const timeout = setTimeout(() => {
            imageCache.delete(src);
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

async function loadPostPortrait(src) {
    if (!src) return null;
    const code = String(src)
        .match(
            /\b((?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|RB\d{1,2}|AD\d{1,2}|LM|P)-\d{1,3})(?=[._/?#]|$)/i
        )?.[1]
        ?.toUpperCase();
    const storage = globalThis.window?.APP_CONFIG?.SUPABASE_URL;
    const candidates = [src];
    if (code) {
        if (storage)
            candidates.push(
                `${storage}/storage/v1/object/public/deck-images/${encodeURIComponent(code)}.webp`
            );
        candidates.push(
            `https://images.digimoncard.io/images/cards/${code}.webp`,
            `https://images.digimoncard.io/images/cards/${code}.jpg`,
            `https://deckbuilder.egmanevents.com/card_images/digimon/${code}.webp`
        );
    }
    for (const candidate of new Set(candidates)) {
        const image = await loadPostImage(candidate);
        if (image) return image;
    }
    return null;
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

function paintHazard(ctx, image, x, y, size, color, opacity = 1, crop = false) {
    if (!image) return;
    const tint = document.createElement('canvas');
    tint.width = 560;
    tint.height = 560;
    const buffer = tint.getContext('2d');
    buffer.drawImage(image, 0, 0, 560, 560);
    buffer.globalCompositeOperation = 'source-in';
    const gradient = buffer.createLinearGradient(0, 70, 0, 490);
    gradient.addColorStop(0, color.toLowerCase() === '#ef646b' ? '#ff8085' : color);
    gradient.addColorStop(1, color.toLowerCase() === '#ef646b' ? '#d23a4a' : color);
    buffer.fillStyle = gradient;
    buffer.fillRect(0, 0, 560, 560);
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(x + size / 2, y + size / 2);
    if (opacity === 1) {
        ctx.shadowColor = color + '59';
        ctx.shadowBlur = size * 0.12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }
    if (crop && buffer.getImageData) {
        const pixels = buffer.getImageData(0, 0, 560, 560)?.data;
        let left = 560,
            top = 560,
            right = 0,
            bottom = 0;
        if (pixels) {
            for (let y = 0; y < 560; y++)
                for (let x = 0; x < 560; x++) {
                    if (pixels[(y * 560 + x) * 4 + 3] > 20) {
                        left = Math.min(left, x);
                        top = Math.min(top, y);
                        right = Math.max(right, x);
                        bottom = Math.max(bottom, y);
                    }
                }
        }
        if (right > left && bottom > top) {
            const width = (size * (right - left + 1)) / (bottom - top + 1);
            ctx.drawImage(
                tint,
                left,
                top,
                right - left + 1,
                bottom - top + 1,
                -width / 2,
                -size / 2,
                width,
                size
            );
        } else ctx.drawImage(tint, -size / 2, -size / 2, size, size);
    } else ctx.drawImage(tint, -size / 2, -size / 2, size, size);
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
        // BT24-101 centers on x=220 of its 430px source, at any image resolution.
        const centerX = /\bBT24-101(?=[._/?#]|$)/i.test(image.src || '') ? 220 / 430 : 0.5;
        ctx.drawImage(image, x - width * centerX, top, width, height);
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

const SOCIAL_PATHS = {
    instagram:
        'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
    x: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z'
};
function paintSocialIcon(ctx, name, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 24, size / 24);
    ctx.fillStyle = '#e0e3e5';
    ctx.fill(new Path2D(SOCIAL_PATHS[name]));
    ctx.restore();
}

function postFooter(ctx, hazard, accent, language) {
    ctx.save();
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(64, 1164);
    ctx.lineTo(1016, 1164);
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 40px "Arial Black", Arial';
    const brandWidth = ctx.measureText('DIGIMON CWB').width;
    const titleMetrics = ctx.measureText('DIGIMON CWB');
    ctx.font = '600 28px Arial';
    const subtitle = 'Digimon Card Game Community';
    const subtitleSize = Math.min(
        28,
        (28 * brandWidth) / Math.max(1, ctx.measureText(subtitle).width)
    );
    ctx.font = `600 ${subtitleSize}px Arial`;
    const subtitleMetrics = ctx.measureText(subtitle);
    const titleAscent = titleMetrics.actualBoundingBoxAscent || 30;
    const titleDescent = titleMetrics.actualBoundingBoxDescent || 1;
    const subtitleAscent = subtitleMetrics.actualBoundingBoxAscent || subtitleSize * 0.75;
    const subtitleDescent = subtitleMetrics.actualBoundingBoxDescent || subtitleSize * 0.2;
    const brandHeight = titleAscent + titleDescent + 10 + subtitleAscent + subtitleDescent;
    const footerCenter = (1164 + POST_FORMAT.height) / 2;
    const brandTop = footerCenter - brandHeight / 2;
    const brandTextLeft = 64 + brandHeight + 24;
    paintHazard(ctx, hazard, 64, brandTop, brandHeight, accent, 1, true);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 40px "Arial Black", Arial';
    ctx.fillText('DIGIMON CWB', brandTextLeft, brandTop + titleAscent, brandWidth);
    ctx.fillStyle = '#aab1b5';
    ctx.font = `600 ${subtitleSize}px Arial`;
    ctx.fillText(
        subtitle,
        brandTextLeft,
        brandTop + titleAscent + titleDescent + 10 + subtitleAscent
    );
    ctx.textBaseline = 'middle';
    ctx.font = '700 26px Arial';
    const handles = ['@digimoncwb', '@digimon_cwb'];
    const iconSize = 26,
        gap = 12;
    const socialWidth =
        iconSize + gap + Math.max(...handles.map((handle) => ctx.measureText(handle).width));
    const socialLeft = 1012 - socialWidth;
    ctx.textAlign = 'left';
    ctx.font = '600 20px Arial';
    ctx.fillStyle = '#aab1b5';
    ctx.fillText(
        language === 'en' ? 'Follow us:' : 'Siga nas redes',
        socialLeft,
        footerCenter - 35
    );
    ['instagram', 'x'].forEach((network, index) => {
        const baseline = footerCenter + 2 + index * 34;
        paintSocialIcon(ctx, network, socialLeft, baseline - iconSize / 2, iconSize);
        ctx.font = '700 26px Arial';
        ctx.fillStyle = '#e0e3e5';
        ctx.fillText(handles[index], socialLeft + iconSize + gap, baseline);
    });
    ctx.restore();
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
    fitPostText(ctx, player.name, portrait.width, isWinner ? 29 : 27, 700, 20);
    ctx.fillText(player.name, portrait.x, top + 74, portrait.width);
}

function paintPodium(ctx, event, title, images, hazard, accent, storeLogo, language) {
    const english = language === 'en';
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
    ctx.fillText(liveData.displayDate(event.isoDate), 66, metadataY);
    ctx.fillStyle = accent;
    fitPostText(
        ctx,
        `· ${event.players} ${english ? 'PLAYERS' : 'JOGADORES'} · ${event.format}`,
        610,
        32,
        700
    );
    ctx.fillText(
        `· ${event.players} ${english ? 'PLAYERS' : 'JOGADORES'} · ${event.format}`,
        190,
        metadataY,
        610
    );
    paintStoreLogo(ctx, storeLogo, 728, 50, 280, 144);
    const portraits = [
        {
            ...winnerCenter,
            radius: 185,
            label: english ? 'WINNER' : 'CAMPEÃO',
            color: '#e2bb68',
            labelY: 425,
            textY: 888,
            width: 390
        },
        {
            x: 202,
            y: 868,
            radius: 125,
            label: english ? '2nd' : '2º',
            color: '#c8ced5',
            labelY: 693,
            textY: 1027,
            width: 300
        },
        {
            x: 878,
            y: 868,
            radius: 125,
            label: english ? '3rd' : '3º',
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
    postFooter(ctx, hazard, accent, language);
}

function paintWeekly(ctx, hazard, accent, images, storeLogos, events, weekEvents, settings) {
    const english = settings.language === 'en';
    paintHazard(ctx, hazard, 52, 64, 78, accent);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    fitPostText(ctx, 'WEEKLY RECAP', 540, 46, 900, 32);
    ctx.fillText('WEEKLY RECAP', 158, 120, 540);
    ctx.textAlign = 'right';
    ctx.fillStyle = accent;
    ctx.font = '800 36px Arial';
    const start = settings.week;
    ctx.fillText(
        `${liveData.displayDate(start)} — ${liveData.displayDate(liveData.weekEnd(start))}`,
        1008,
        112
    );
    ctx.font = '700 24px Arial';
    ctx.fillStyle = '#b9bec2';
    ctx.fillText('Curitiba/PR, Brazil', 1008, 153);
    const columns = [
        { label: english ? 'DAY' : 'DIA', x: 118, align: 'center' },
        { label: english ? 'DECK / PLAYER' : 'DECK / JOGADOR', x: 410, align: 'left' },
        { label: english ? 'STORE' : 'LOJA', x: 902, align: 'center' }
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
            `${english ? 'PAGE' : 'PÁGINA'} ${Number(settings.page) + 1} / ${pageCount}`,
            1008,
            197
        );
    }
    events.forEach((event, index) => {
        const winner = event.winner || {
            deck: english ? 'Result not recorded' : 'Resultado não registrado',
            name: '',
            image: ''
        };
        const y = 300 + index * 142;
        ctx.fillStyle = '#1b1e21';
        ctx.beginPath();
        ctx.roundRect(52, y, 976, 126, 24);
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 32px Arial';
        ctx.fillText(
            english
                ? ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][
                      new Date(event.isoDate + 'T12:00:00Z').getUTCDay()
                  ]
                : event.day,
            118,
            y + 54
        );
        ctx.fillStyle = '#b9bec2';
        ctx.font = '700 26px Arial';
        ctx.fillText(liveData.displayDate(event.isoDate), 118, y + 89);
        if (!event.deckless)
            paintPortrait(ctx, images[index], 320, y + 63, 49, accent, winner.deck.slice(0, 2));
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        if (event.deckless) {
            fitPostText(ctx, winner.name, 530, 34, 800, 24);
            ctx.fillText(winner.name, 265, y + 72, 530);
        } else {
            fitPostText(ctx, winner.deck, 385, 34, 800, 24);
            ctx.fillText(winner.deck, 410, y + 54, 385);
            ctx.fillStyle = '#c7cbd0';
            fitPostText(ctx, winner.name, 385, 29, 700, 24);
            ctx.fillText(winner.name, 410, y + 92, 385);
        }
        ctx.textAlign = 'center';
        paintStoreLogo(ctx, storeLogos[index], 814, y + 12, 176, 70);
        if (!storeLogos[index]) {
            ctx.fillStyle = accent;
            fitPostText(ctx, event.store.toUpperCase(), 172, 24, 800, 18);
            ctx.fillText(event.store.toUpperCase(), 902, y + 57, 172);
        }
        ctx.font = '700 21px Arial';
        ctx.fillStyle = '#b9bec2';
        ctx.fillText(
            `${event.players} ${event.players === 1 ? 'player' : 'players'}`,
            902,
            y + 108
        );
    });
    const totals = [
        { value: weekEvents.length, label: english ? 'TOURNAMENTS' : 'TORNEIOS' },
        {
            value: weekEvents.reduce((sum, event) => sum + event.players, 0),
            label: english ? 'ENTRIES' : 'PARTICIPAÇÕES'
        },
        {
            value: [...new Set(weekEvents.map((event) => event.format))].join(' / '),
            label: english ? 'FORMAT' : 'FORMATO'
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
    postFooter(ctx, hazard, accent, settings.language);
}

export async function renderPost(canvas, settings, allEvents, hazardUrl, isCurrent) {
    settings = { ...settings, language: 'en' };
    const event =
        allEvents.find((event) => event.id === settings.tournament) ||
        allEvents.find((event) => event.winner);
    const weekEvents = allEvents
        .filter(
            (event) =>
                event.isoDate >= settings.week && event.isoDate <= liveData.weekEnd(settings.week)
        )
        .sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.id.localeCompare(b.id));
    const weeklyRows = weekEvents.slice(settings.page * 5, settings.page * 5 + 5);
    if (settings.template === 'weekly' ? !weeklyRows.length : !event?.winner)
        return { ready: false, message: 'Nenhum resultado disponível para este modelo.' };
    const events = settings.template === 'weekly' ? weeklyRows : [event];
    const sources =
        settings.template === 'weekly'
            ? weeklyRows.map((event) => event.winner?.image || '')
            : event.podium.map((player) => player?.image || '');
    const [hazard, images, logos] = await Promise.all([
        loadPostImage(hazardUrl),
        Promise.all(sources.map(loadPostPortrait)),
        Promise.all(events.map((event) => loadPostImage(event.logo)))
    ]);
    if (!isCurrent()) return { ready: false, message: '' };
    if (canvas.width !== POST_FORMAT.width) canvas.width = POST_FORMAT.width;
    if (canvas.height !== POST_FORMAT.height) canvas.height = POST_FORMAT.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, POST_FORMAT.width, POST_FORMAT.height);
    ctx.fillStyle = '#242629';
    ctx.fillRect(0, 0, POST_FORMAT.width, POST_FORMAT.height);
    ctx.textBaseline = 'alphabetic';
    if (settings.template === 'weekly')
        paintWeekly(ctx, hazard, settings.accent, images, logos, weeklyRows, weekEvents, settings);
    else
        paintPodium(
            ctx,
            event,
            settings.title || postEventTitle(event),
            images,
            hazard,
            settings.accent,
            logos[0],
            settings.language
        );
    const missing =
        !hazard ||
        logos.some((image) => !image) ||
        images.some(
            (image, index) =>
                !image &&
                !(settings.template === 'weekly' ? weeklyRows[index].deckless : event.deckless)
        );
    return {
        ready: true,
        message: missing
            ? 'Algumas imagens não carregaram. Confira a prévia antes de baixar.'
            : 'Prévia pronta para exportar.'
    };
}
