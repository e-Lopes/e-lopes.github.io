-- Migration: create v_deck_color_stats SQL view
-- Replaces the client-side aggregation in loadDeckColorStatisticsRows().
-- Produces one row per (month, format_code, color_code) with usage stats and top deck.

DROP VIEW IF EXISTS public.v_deck_color_stats;

CREATE OR REPLACE VIEW public.v_deck_color_stats
WITH (security_invoker = true)
AS
WITH
-- Unnest each deck's color string into individual normalized color codes.
-- e.g. "Red/Blue" -> ('r'), ('u')
color_tokens AS (
    SELECT
        tr.id                                                       AS result_id,
        tr.placement,
        d.name                                                      AS deck_name,
        date_trunc('month', tr.tournament_date::timestamptz)        AS month,
        COALESCE(f.code, 'UNSPECIFIED')                             AS format_code,
        CASE lower(trim(token))
            WHEN 'r'        THEN 'r'
            WHEN 'red'      THEN 'r'
            WHEN 'vermelho' THEN 'r'
            WHEN 'u'        THEN 'u'
            WHEN 'blue'     THEN 'u'
            WHEN 'azul'     THEN 'u'
            WHEN 'b'        THEN 'b'
            WHEN 'black'    THEN 'b'
            WHEN 'preto'    THEN 'b'
            WHEN 'w'        THEN 'w'
            WHEN 'white'    THEN 'w'
            WHEN 'branco'   THEN 'w'
            WHEN 'g'        THEN 'g'
            WHEN 'green'    THEN 'g'
            WHEN 'verde'    THEN 'g'
            WHEN 'y'        THEN 'y'
            WHEN 'yellow'   THEN 'y'
            WHEN 'amarelo'  THEN 'y'
            WHEN 'p'        THEN 'p'
            WHEN 'purple'   THEN 'p'
            WHEN 'roxo'     THEN 'p'
            ELSE NULL
        END AS color_code
    FROM public.tournament_results tr
    JOIN public.decks d ON d.id = tr.deck_id
    LEFT JOIN public.tournament t ON t.id = tr.tournament_id
    LEFT JOIN public.formats f ON f.id = t.format_id,
    regexp_split_to_table(lower(coalesce(d.colors, '')), '[^a-z0-9]+') AS token
    WHERE tr.placement > 0
),
-- Keep only rows where the token resolved to a known color code.
valid_tokens AS (
    SELECT * FROM color_tokens WHERE color_code IS NOT NULL
),
-- Total valid tournament results per (month, format) — the denominator for usage_percent.
-- Matches JS: periodTotals counts ALL placements > 0, not just those with colors.
period_totals AS (
    SELECT
        date_trunc('month', tr.tournament_date::timestamptz) AS month,
        COALESCE(f.code, 'UNSPECIFIED')                      AS format_code,
        count(*)                                             AS total
    FROM public.tournament_results tr
    LEFT JOIN public.tournament t ON t.id = tr.tournament_id
    LEFT JOIN public.formats f ON f.id = t.format_id
    WHERE tr.placement > 0
    GROUP BY 1, 2
),
-- Aggregate usage / titles / top4 per (month, format, color).
color_agg AS (
    SELECT
        month,
        format_code,
        color_code,
        count(*)                                              AS usage_count,
        sum(CASE WHEN placement = 1 THEN 1 ELSE 0 END)       AS titles,
        sum(CASE WHEN placement <= 4 THEN 1 ELSE 0 END)      AS top4_total
    FROM valid_tokens
    GROUP BY month, format_code, color_code
),
-- Aggregate usage / titles / top4 per (month, format, color, deck).
deck_color_agg AS (
    SELECT
        month,
        format_code,
        color_code,
        deck_name,
        count(*)                                              AS deck_usage,
        sum(CASE WHEN placement = 1 THEN 1 ELSE 0 END)       AS deck_titles,
        sum(CASE WHEN placement <= 4 THEN 1 ELSE 0 END)      AS deck_top4
    FROM valid_tokens
    GROUP BY month, format_code, color_code, deck_name
),
-- Pick the best-performing deck per (month, format, color).
-- Tiebreak order mirrors the JS: titles DESC, top4 DESC, usage DESC, name ASC.
top_deck_per_color AS (
    SELECT DISTINCT ON (month, format_code, color_code)
        month,
        format_code,
        color_code,
        deck_name        AS top_deck,
        deck_titles      AS top_deck_titles
    FROM deck_color_agg
    ORDER BY month, format_code, color_code,
        deck_titles DESC, deck_top4 DESC, deck_usage DESC, deck_name ASC
)
SELECT
    ca.month,
    ca.format_code,
    ca.color_code,
    CASE ca.color_code
        WHEN 'r' THEN 'Red'
        WHEN 'u' THEN 'Blue'
        WHEN 'b' THEN 'Black'
        WHEN 'w' THEN 'White'
        WHEN 'g' THEN 'Green'
        WHEN 'y' THEN 'Yellow'
        WHEN 'p' THEN 'Purple'
        ELSE upper(ca.color_code)
    END                                                                          AS color,
    ca.usage_count,
    round(
        (100.0 * ca.usage_count / nullif(pt.total, 0))::numeric, 2
    )                                                                            AS usage_percent,
    ca.titles,
    ca.top4_total,
    td.top_deck,
    td.top_deck_titles
FROM color_agg ca
JOIN period_totals pt USING (month, format_code)
JOIN top_deck_per_color td USING (month, format_code, color_code)
ORDER BY
    ca.month DESC,
    ca.format_code,
    (100.0 * ca.usage_count / nullif(pt.total, 0)) DESC;

COMMENT ON VIEW public.v_deck_color_stats IS
    'Metagame color statistics per month/format. Replaces client-side aggregation. '
    'One row per (month, format_code, color_code). '
    'usage_percent denominator = all tournament_results in the period (placement > 0).';
