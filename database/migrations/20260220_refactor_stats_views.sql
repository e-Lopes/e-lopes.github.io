-- Refactor analytics views with richer TCG metrics while keeping existing view names.

BEGIN;

CREATE OR REPLACE VIEW public.v_deck_representation AS
WITH base AS (
    SELECT
        tr.id,
        tr.tournament_id,
        tr.tournament_date,
        tr.total_players,
        tr.placement,
        tr.player_id,
        d.name AS deck_name
    FROM public.tournament_results tr
    JOIN public.decks d ON d.id = tr.deck_id
)
SELECT
    b.deck_name AS deck,
    COUNT(*) AS appearances,
    COUNT(DISTINCT b.tournament_id) AS tournaments_played,
    COUNT(DISTINCT b.player_id) AS unique_players,
    SUM(CASE WHEN b.placement = 1 THEN 1 ELSE 0 END) AS titles,
    SUM(CASE WHEN b.placement <= 4 THEN 1 ELSE 0 END) AS top4_finishes,
    SUM(CASE WHEN b.placement <= LEAST(8, COALESCE(b.total_players, 8)) THEN 1 ELSE 0 END) AS top_cut_finishes,
    ROUND(AVG(b.placement::numeric), 2) AS avg_placement,
    ROUND((100.0 * COUNT(*)::numeric) / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) AS meta_share_percent,
    ROUND(
        (
            100.0
            * SUM(CASE WHEN b.placement <= LEAST(8, COALESCE(b.total_players, 8)) THEN 1 ELSE 0 END)::numeric
        ) / NULLIF(COUNT(*), 0),
        2
    ) AS top_cut_conversion_percent
FROM base b
GROUP BY b.deck_name
ORDER BY meta_share_percent DESC, appearances DESC, titles DESC;


CREATE OR REPLACE VIEW public.v_deck_stats AS
WITH base AS (
    SELECT
        tr.placement,
        tr.total_players,
        d.name AS deck_name
    FROM public.tournament_results tr
    JOIN public.decks d ON d.id = tr.deck_id
),
scored AS (
    SELECT
        b.*,
        CASE
            WHEN b.placement = 1 THEN 15
            WHEN b.placement = 2 THEN 10
            WHEN b.placement = 3 THEN 7
            WHEN b.placement = 4 THEN 5
            WHEN b.placement <= 8 THEN 3
            WHEN b.placement <= 16 THEN 1
            ELSE 0
        END AS placement_points
    FROM base b
)
SELECT
    s.deck_name AS deck,
    SUM(CASE WHEN s.placement <= 4 THEN 1 ELSE 0 END) AS top4_total,
    SUM(CASE WHEN s.placement = 1 THEN 1 ELSE 0 END) AS titles,
    COUNT(*) AS entries,
    SUM(CASE WHEN s.placement <= 8 THEN 1 ELSE 0 END) AS top8_total,
    SUM(CASE WHEN s.placement <= LEAST(8, COALESCE(s.total_players, 8)) THEN 1 ELSE 0 END) AS top_cut_total,
    ROUND(AVG(s.placement::numeric), 2) AS avg_placement,
    MIN(s.placement) AS best_finish,
    MAX(s.placement) AS worst_finish,
    SUM(s.placement_points) AS ranking_points,
    ROUND((100.0 * SUM(CASE WHEN s.placement = 1 THEN 1 ELSE 0 END)::numeric) / NULLIF(COUNT(*), 0), 2) AS title_rate_percent,
    ROUND((100.0 * SUM(CASE WHEN s.placement <= 4 THEN 1 ELSE 0 END)::numeric) / NULLIF(COUNT(*), 0), 2) AS top4_rate_percent,
    ROUND(
        (
            100.0
            * SUM(CASE WHEN s.placement <= LEAST(8, COALESCE(s.total_players, 8)) THEN 1 ELSE 0 END)::numeric
        ) / NULLIF(COUNT(*), 0),
        2
    ) AS top_cut_conversion_percent,
    DENSE_RANK() OVER (
        ORDER BY
            SUM(s.placement_points) DESC,
            SUM(CASE WHEN s.placement = 1 THEN 1 ELSE 0 END) DESC,
            COUNT(*) DESC
    ) AS performance_rank
FROM scored s
GROUP BY s.deck_name
ORDER BY performance_rank, deck;


CREATE OR REPLACE VIEW public.v_meta_by_month AS
WITH base AS (
    SELECT
        date_trunc('month', tr.tournament_date::timestamp with time zone) AS month,
        COALESCE(f.code, 'UNSPECIFIED') AS format_code,
        d.name AS deck_name,
        tr.placement,
        tr.total_players
    FROM public.tournament_results tr
    JOIN public.decks d ON d.id = tr.deck_id
    LEFT JOIN public.tournament t ON t.id = tr.tournament_id
    LEFT JOIN public.formats f ON f.id = t.format_id
),
rollup AS (
    SELECT
        b.month,
        b.format_code,
        b.deck_name,
        COUNT(*) AS appearances,
        SUM(CASE WHEN b.placement <= 4 THEN 1 ELSE 0 END) AS top4_total,
        SUM(CASE WHEN b.placement = 1 THEN 1 ELSE 0 END) AS titles,
        SUM(CASE WHEN b.placement <= LEAST(8, COALESCE(b.total_players, 8)) THEN 1 ELSE 0 END) AS top_cut_total
    FROM base b
    GROUP BY b.month, b.format_code, b.deck_name
)
SELECT
    r.month,
    r.deck_name AS deck,
    r.appearances,
    r.format_code,
    ROUND((100.0 * r.appearances::numeric) / NULLIF(SUM(r.appearances) OVER (PARTITION BY r.month, r.format_code), 0), 2) AS meta_share_percent,
    r.top4_total,
    r.titles,
    ROUND((100.0 * r.top_cut_total::numeric) / NULLIF(r.appearances, 0), 2) AS top_cut_conversion_percent
FROM rollup r
ORDER BY r.month DESC, r.format_code, meta_share_percent DESC, r.appearances DESC;


CREATE OR REPLACE VIEW public.v_monthly_ranking AS
WITH base AS (
    SELECT
        date_trunc('month', tr.tournament_date::timestamp with time zone) AS month,
        p.name AS player_name,
        tr.placement,
        tr.total_players
    FROM public.tournament_results tr
    JOIN public.players p ON p.id = tr.player_id
),
scored AS (
    SELECT
        b.*,
        CASE
            WHEN b.placement = 1 THEN 15
            WHEN b.placement = 2 THEN 10
            WHEN b.placement = 3 THEN 7
            WHEN b.placement = 4 THEN 5
            WHEN b.placement <= 8 THEN 3
            WHEN b.placement <= 16 THEN 1
            ELSE 0
        END AS placement_points
    FROM base b
)
SELECT
    s.month,
    s.player_name AS player,
    SUM(s.placement_points) AS points,
    COUNT(*) AS entries,
    SUM(CASE WHEN s.placement <= 8 THEN 1 ELSE 0 END) AS top8_total,
    SUM(CASE WHEN s.placement <= 4 THEN 1 ELSE 0 END) AS top4_total,
    SUM(CASE WHEN s.placement = 1 THEN 1 ELSE 0 END) AS titles,
    ROUND(AVG(s.placement::numeric), 2) AS avg_placement,
    ROUND(
        (
            100.0
            * SUM(CASE WHEN s.placement <= LEAST(8, COALESCE(s.total_players, 8)) THEN 1 ELSE 0 END)::numeric
        ) / NULLIF(COUNT(*), 0),
        2
    ) AS top_cut_rate_percent,
    DENSE_RANK() OVER (
        PARTITION BY s.month
        ORDER BY
            SUM(s.placement_points) DESC,
            SUM(CASE WHEN s.placement = 1 THEN 1 ELSE 0 END) DESC,
            COUNT(*) DESC
    ) AS monthly_rank
FROM scored s
GROUP BY s.month, s.player_name
ORDER BY s.month DESC, monthly_rank, player;


CREATE OR REPLACE VIEW public.v_player_ranking AS
WITH base AS (
    SELECT
        p.name AS player_name,
        tr.tournament_date,
        tr.deck_id,
        tr.placement,
        tr.total_players
    FROM public.tournament_results tr
    JOIN public.players p ON p.id = tr.player_id
),
scored AS (
    SELECT
        b.*,
        CASE
            WHEN b.placement = 1 THEN 15
            WHEN b.placement = 2 THEN 10
            WHEN b.placement = 3 THEN 7
            WHEN b.placement = 4 THEN 5
            WHEN b.placement <= 8 THEN 3
            WHEN b.placement <= 16 THEN 1
            ELSE 0
        END AS placement_points
    FROM base b
)
SELECT
    s.player_name AS player,
    SUM(CASE WHEN s.placement <= 4 THEN 1 ELSE 0 END) AS top4_total,
    SUM(CASE WHEN s.placement = 1 THEN 1 ELSE 0 END) AS titles,
    SUM(s.placement_points) AS ranking_points,
    COUNT(*) AS entries,
    SUM(CASE WHEN s.placement <= 8 THEN 1 ELSE 0 END) AS top8_total,
    ROUND(AVG(s.placement::numeric), 2) AS avg_placement,
    COUNT(DISTINCT s.deck_id) AS unique_decks_used,
    MAX(s.tournament_date) AS last_event_date,
    ROUND((100.0 * SUM(CASE WHEN s.placement = 1 THEN 1 ELSE 0 END)::numeric) / NULLIF(COUNT(*), 0), 2) AS title_rate_percent,
    ROUND(
        (
            100.0
            * SUM(CASE WHEN s.placement <= LEAST(8, COALESCE(s.total_players, 8)) THEN 1 ELSE 0 END)::numeric
        ) / NULLIF(COUNT(*), 0),
        2
    ) AS top_cut_rate_percent,
    DENSE_RANK() OVER (
        ORDER BY
            SUM(s.placement_points) DESC,
            SUM(CASE WHEN s.placement = 1 THEN 1 ELSE 0 END) DESC,
            COUNT(*) DESC
    ) AS overall_rank
FROM scored s
GROUP BY s.player_name
ORDER BY overall_rank, player;


CREATE OR REPLACE VIEW public.v_podium AS
SELECT
    tr.id,
    s.name AS store,
    tr.tournament_date,
    tr.placement,
    p.name AS player,
    d.name AS deck,
    tr.tournament_id,
    t.tournament_name,
    COALESCE(f.code, 'UNSPECIFIED') AS format_code
FROM public.tournament_results tr
JOIN public.stores s ON s.id = tr.store_id
JOIN public.decks d ON d.id = tr.deck_id
LEFT JOIN public.players p ON p.id = tr.player_id
LEFT JOIN public.tournament t ON t.id = tr.tournament_id
LEFT JOIN public.formats f ON f.id = t.format_id;


CREATE OR REPLACE VIEW public.v_podium_full AS
SELECT
    tr.id,
    tr.store_id,
    s.name AS store,
    tr.tournament_date,
    tr.placement,
    p.name AS player,
    d.name AS deck,
    di.image_url,
    tr.total_players,
    tr.tournament_id,
    tr.decklist,
    t.tournament_name,
    t.instagram_link,
    COALESCE(f.code, 'UNSPECIFIED') AS format_code
FROM public.tournament_results tr
JOIN public.stores s ON s.id = tr.store_id
JOIN public.decks d ON d.id = tr.deck_id
LEFT JOIN public.players p ON p.id = tr.player_id
LEFT JOIN public.tournament t ON t.id = tr.tournament_id
LEFT JOIN public.formats f ON f.id = t.format_id
LEFT JOIN LATERAL (
    SELECT dimg.image_url
    FROM public.deck_images dimg
    WHERE dimg.deck_id = d.id
    ORDER BY dimg.created_at DESC, dimg.id DESC
    LIMIT 1
) di ON true;


CREATE OR REPLACE VIEW public.v_store_champions AS
WITH base AS (
    SELECT
        s.name AS store_name,
        p.name AS player_name,
        tr.placement,
        tr.total_players
    FROM public.tournament_results tr
    JOIN public.stores s ON s.id = tr.store_id
    JOIN public.players p ON p.id = tr.player_id
),
scored AS (
    SELECT
        b.*,
        CASE
            WHEN b.placement = 1 THEN 15
            WHEN b.placement = 2 THEN 10
            WHEN b.placement = 3 THEN 7
            WHEN b.placement = 4 THEN 5
            WHEN b.placement <= 8 THEN 3
            WHEN b.placement <= 16 THEN 1
            ELSE 0
        END AS placement_points
    FROM base b
),
agg AS (
    SELECT
        s.store_name,
        s.player_name,
        COUNT(*) AS entries,
        SUM(CASE WHEN s.placement = 1 THEN 1 ELSE 0 END) AS titles,
        SUM(CASE WHEN s.placement <= 4 THEN 1 ELSE 0 END) AS top4_total,
        SUM(CASE WHEN s.placement <= 8 THEN 1 ELSE 0 END) AS top8_total,
        SUM(s.placement_points) AS ranking_points,
        ROUND(AVG(s.placement::numeric), 2) AS avg_placement
    FROM scored s
    GROUP BY s.store_name, s.player_name
)
SELECT
    a.store_name AS store,
    a.player_name AS player,
    a.titles,
    a.entries,
    a.top4_total,
    a.top8_total,
    a.ranking_points,
    a.avg_placement,
    ROUND((100.0 * a.titles::numeric) / NULLIF(SUM(a.titles) OVER (PARTITION BY a.store_name), 0), 2) AS store_title_share_percent,
    DENSE_RANK() OVER (
        PARTITION BY a.store_name
        ORDER BY
            a.titles DESC,
            a.ranking_points DESC,
            a.entries DESC
    ) AS store_rank
FROM agg a
ORDER BY store, store_rank, player;


ALTER VIEW public.v_podium SET (security_invoker = true);
ALTER VIEW public.v_meta_by_month SET (security_invoker = true);
ALTER VIEW public.v_player_ranking SET (security_invoker = true);
ALTER VIEW public.v_deck_representation SET (security_invoker = true);
ALTER VIEW public.v_podium_full SET (security_invoker = true);
ALTER VIEW public.v_deck_stats SET (security_invoker = true);
ALTER VIEW public.v_store_champions SET (security_invoker = true);
ALTER VIEW public.v_monthly_ranking SET (security_invoker = true);

COMMIT;
