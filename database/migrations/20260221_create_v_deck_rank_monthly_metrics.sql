BEGIN;

DROP VIEW IF EXISTS public.v_deck_rank;

CREATE VIEW public.v_deck_rank AS
WITH base AS (
    SELECT
        date_trunc('month', tr.tournament_date::timestamp with time zone) AS month,
        tr.tournament_id,
        tr.store_id,
        tr.tournament_date,
        tr.player_id,
        tr.placement,
        tr.total_players,
        COALESCE(t.rounds, CASE WHEN tr.total_players <= 8 THEN 3 ELSE 4 END) AS rounds,
        d.name AS deck_name
    FROM public.tournament_results tr
    JOIN public.decks d ON d.id = tr.deck_id
    LEFT JOIN public.tournament t ON t.id = tr.tournament_id
),
scored AS (
    SELECT
        b.month,
        b.tournament_id,
        b.store_id,
        b.tournament_date,
        b.player_id,
        b.placement,
        b.total_players,
        b.rounds,
        b.deck_name,
        CASE
            WHEN b.placement = 1 THEN 4
            WHEN b.placement = 2 THEN 3
            WHEN b.placement = 3 THEN 2
            WHEN b.placement = 4 THEN 1
            ELSE 0
        END AS placement_points,
        CASE
            WHEN COALESCE(b.total_players, 0) <= 8 THEN 1.0
            WHEN b.total_players BETWEEN 9 AND 16 THEN 1.2
            WHEN b.total_players >= 17 AND COALESCE(b.rounds, 0) >= 5 THEN 1.5
            WHEN b.total_players >= 17 THEN 1.0
            ELSE 1.0
        END AS points_multiplier,
        CASE
            WHEN COALESCE(b.total_players, 0) <= 8 THEN 100
            WHEN b.total_players BETWEEN 9 AND 16 THEN 120
            WHEN b.total_players >= 17 AND COALESCE(b.rounds, 0) >= 5 THEN 150
            WHEN b.total_players >= 17 THEN 100
            ELSE 100
        END AS points_weight_percent
    FROM base b
)
SELECT
    s.month,
    s.deck_name AS deck,
    COUNT(*) AS monthly_appearances,
    COUNT(
        DISTINCT COALESCE(
            s.tournament_id::text,
            concat_ws('|', s.store_id::text, s.tournament_date::text)
        )
    ) AS tournament_appearances,
    COUNT(DISTINCT s.player_id) AS unique_players,
    SUM(CASE WHEN s.placement = 1 THEN 1 ELSE 0 END) AS titles,
    SUM(CASE WHEN s.placement <= 4 THEN 1 ELSE 0 END) AS top4_total,
    ROUND(AVG(s.placement::numeric), 0)::integer AS avg_placement,
    MIN(s.placement) AS best_finish,
    MAX(s.placement) AS worst_finish,
    SUM(s.placement_points) AS base_points,
    ROUND(SUM((s.placement_points * s.points_multiplier)::numeric), 2) AS ranking_points,
    DENSE_RANK() OVER (
        PARTITION BY s.month
        ORDER BY
            SUM((s.placement_points * s.points_multiplier)::numeric) DESC,
            SUM(CASE WHEN s.placement = 1 THEN 1 ELSE 0 END) DESC,
            COUNT(*) DESC
    ) AS performance_rank
FROM scored s
GROUP BY s.month, s.deck_name
ORDER BY s.month DESC, performance_rank, deck;

ALTER VIEW public.v_deck_rank SET (security_invoker = true);

COMMIT;
