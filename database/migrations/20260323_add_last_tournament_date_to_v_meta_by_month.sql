-- Migration: 2026-03-23
-- Add last_tournament_date to v_meta_by_month
--
-- Problem: the view only exposed month (truncated to month-start).
-- The Meta Overview modal showed "Mar/26" instead of the actual last event day.
--
-- Fix: expose MAX(tournament_date)::date per (month, format, deck) so the
-- client can display the exact date of the last tournament in that period.

BEGIN;

DROP VIEW IF EXISTS public.v_meta_by_month;

CREATE VIEW public.v_meta_by_month
WITH (security_invoker = true)
AS
WITH base AS (
    SELECT
        date_trunc('month', tr.tournament_date::timestamp with time zone) AS month,
        tr.tournament_date::date                                           AS tournament_date,
        COALESCE(f.code, 'UNSPECIFIED')                                    AS format_code,
        d.name AS deck_name,
        tr.placement
    FROM  public.tournament_results tr
    JOIN  public.decks              d   ON d.id  = tr.deck_id
    LEFT JOIN public.tournament     t   ON t.id  = tr.tournament_id
    LEFT JOIN public.formats        f   ON f.id  = t.format_id
),
rollup AS (
    SELECT
        b.month,
        b.format_code,
        b.deck_name,
        count(*)                                                       AS appearances,
        sum(CASE WHEN b.placement = 1  THEN 1 ELSE 0 END)             AS titles,
        sum(CASE WHEN b.placement <= 2 THEN 1 ELSE 0 END)             AS top2_total,
        sum(CASE WHEN b.placement <= 3 THEN 1 ELSE 0 END)             AS top3_total,
        sum(CASE WHEN b.placement <= 4 THEN 1 ELSE 0 END)             AS top4_total,
        max(b.tournament_date)                                         AS last_tournament_date
    FROM base b
    GROUP BY b.month, b.format_code, b.deck_name
)
SELECT
    month,
    deck_name AS deck,
    appearances,
    format_code,
    round(
        (100.0 * appearances::numeric)
        / NULLIF(sum(appearances) OVER (PARTITION BY month, format_code), 0),
        2
    ) AS meta_share_percent,
    titles,
    top2_total,
    top3_total,
    top4_total,
    last_tournament_date
FROM rollup r
ORDER BY month DESC, format_code,
         round(
             (100.0 * appearances::numeric)
             / NULLIF(sum(appearances) OVER (PARTITION BY month, format_code), 0),
             2
         ) DESC,
         appearances DESC;

COMMENT ON VIEW public.v_meta_by_month IS
    'Meta share per deck per month. '
    'Placement counts: titles=1st, top2_total=1st–2nd, top3_total=1st–3rd, top4_total=1st–4th. '
    'Derive exact placement counts: 2nd = top2_total-titles, 3rd = top3_total-top2_total, 4th = top4_total-top3_total. '
    'last_tournament_date: exact date of the most recent tournament for that deck in that month.';

GRANT ALL ON TABLE public.v_meta_by_month TO anon;
GRANT ALL ON TABLE public.v_meta_by_month TO authenticated;
GRANT ALL ON TABLE public.v_meta_by_month TO service_role;

COMMIT;
