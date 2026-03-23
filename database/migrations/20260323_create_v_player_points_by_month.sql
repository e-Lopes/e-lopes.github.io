-- Migration: 2026-03-23
-- Create v_player_points_by_month (player points per month + format)

BEGIN;

DROP VIEW IF EXISTS public.v_player_points_by_month;

CREATE VIEW public.v_player_points_by_month
WITH (security_invoker = true)
AS
WITH base AS (
    SELECT
        date_trunc('month', tr.tournament_date::timestamp with time zone) AS month,
        COALESCE(f.code, 'UNSPECIFIED') AS format_code,
        p.name AS player,
        tr.placement
    FROM public.tournament_results tr
    JOIN public.players p ON p.id = tr.player_id
    LEFT JOIN public.tournament t ON t.id = tr.tournament_id
    LEFT JOIN public.formats f ON f.id = t.format_id
),
scored AS (
    SELECT
        b.*,
        CASE
            WHEN b.placement = 1  THEN 15
            WHEN b.placement = 2  THEN 10
            WHEN b.placement = 3  THEN 7
            WHEN b.placement = 4  THEN 5
            WHEN b.placement <= 8 THEN 3
            WHEN b.placement <= 16 THEN 1
            ELSE 0
        END AS points
    FROM base b
)
SELECT
    s.month,
    s.format_code,
    s.player,
    SUM(s.points) AS points,
    COUNT(*) AS entries,
    SUM(CASE WHEN s.placement = 1  THEN 1 ELSE 0 END) AS titles,
    SUM(CASE WHEN s.placement <= 4 THEN 1 ELSE 0 END) AS top4_total,
    SUM(CASE WHEN s.placement <= 8 THEN 1 ELSE 0 END) AS top8_total
FROM scored s
GROUP BY s.month, s.format_code, s.player
ORDER BY s.month DESC, s.format_code, points DESC, player;

COMMENT ON VIEW public.v_player_points_by_month IS
    'Player points per month and format. Points: 1st=15, 2nd=10, 3rd=7, 4th=5, top8=3, top16=1.';

GRANT ALL ON TABLE public.v_player_points_by_month TO anon;
GRANT ALL ON TABLE public.v_player_points_by_month TO authenticated;
GRANT ALL ON TABLE public.v_player_points_by_month TO service_role;

COMMIT;
