BEGIN;

DROP VIEW IF EXISTS public.v_top_cards_by_month;

CREATE VIEW public.v_top_cards_by_month AS
WITH base AS (
    SELECT
        date_trunc('month', tr.tournament_date::timestamp with time zone) AS month,
        tr.placement,
        dl.id AS decklist_id,
        dc.card_code,
        dc.card_type,
        dc.card_level,
        dc.is_digi_egg,
        dc.is_staple
    FROM public.tournament_results tr
    JOIN public.decklists dl ON dl.tournament_result_id = tr.id
    JOIN public.decklist_cards dc ON dc.decklist_id = dl.id
    WHERE tr.placement <= 4
),
agg AS (
    SELECT
        b.month,
        b.card_code,
        MAX(b.card_type) FILTER (WHERE b.card_type IS NOT NULL) AS card_type,
        MAX(b.card_level) AS card_level,
        BOOL_OR(b.is_digi_egg) AS is_digi_egg,
        BOOL_OR(b.is_staple) AS is_staple,
        COUNT(DISTINCT b.decklist_id) AS total,
        COUNT(DISTINCT CASE WHEN b.placement = 1 THEN b.decklist_id END) AS champion,
        COUNT(DISTINCT CASE WHEN b.placement <= 2 THEN b.decklist_id END) AS top2,
        COUNT(DISTINCT CASE WHEN b.placement <= 3 THEN b.decklist_id END) AS top3,
        COUNT(DISTINCT CASE WHEN b.placement <= 4 THEN b.decklist_id END) AS top4
    FROM base b
    GROUP BY b.month, b.card_code
)
SELECT
    a.month,
    a.card_code,
    a.card_type,
    a.card_level,
    a.is_digi_egg,
    a.is_staple,
    a.total,
    a.champion,
    a.top2,
    a.top3,
    a.top4,
    DENSE_RANK() OVER (
        PARTITION BY a.month
        ORDER BY a.total DESC, a.champion DESC, a.top2 DESC, a.card_code
    ) AS monthly_rank
FROM agg a
ORDER BY a.month DESC, monthly_rank, a.card_code;

ALTER VIEW public.v_top_cards_by_month SET (security_invoker = true);

GRANT ALL ON TABLE public.v_top_cards_by_month TO anon;
GRANT ALL ON TABLE public.v_top_cards_by_month TO authenticated;
GRANT ALL ON TABLE public.v_top_cards_by_month TO service_role;

COMMIT;
