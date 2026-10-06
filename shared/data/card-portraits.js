(function (root) {
    'use strict';
    const defaults = Object.freeze({ center_x: 0.5, offset_y: 0, zoom: 2.3 });
    let settings = new Map();
    function codeFromImage(src) {
        return (
            String(src || '')
                .match(
                    /\b((?:BT\d{1,2}|EX\d{1,2}|ST\d{1,2}|RB\d{1,2}|AD\d{1,2}|LM|P)-\d{1,3})(?=[._/?#]|$)/i
                )?.[1]
                ?.toUpperCase() || ''
        );
    }
    function get(src) {
        return settings.get(codeFromImage(src)) || defaults;
    }
    function style(setting) {
        return {
            transform: `scale(${setting.zoom}) translate(${(0.5 - setting.center_x) * 100}%, ${-setting.offset_y * 100}%)`,
            transformOrigin: 'center 20%'
        };
    }
    async function load() {
        const response = await fetch(
            `${root.APP_CONFIG.SUPABASE_URL}/rest/v1/card_portrait_settings?select=card_code,center_x,offset_y,zoom`,
            { headers: root.createSupabaseHeaders() }
        );
        if (!response.ok) throw Error('Não foi possível carregar os enquadramentos.');
        const rows = await response.json();
        if (!Array.isArray(rows)) throw Error('Enquadramentos inválidos.');
        settings = new Map(rows.map((row) => [row.card_code, row]));
        root.dispatchEvent(new Event('digistats:portraits-changed'));
    }
    const codes = () => [...settings.keys()].sort();
    const api = { get, style, load, codeFromImage, defaults, codes };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.cardPortraits = api;
})(typeof window !== 'undefined' ? window : globalThis);
