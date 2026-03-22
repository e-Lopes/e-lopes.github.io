-- Migration: 2026-03-22
-- Performance: Top Cards loading optimization
--
-- Problem: v_top_cards_by_month did not include card_name, so the client had to:
--   1. Fetch the entire cards_cache table via paginated requests
--   2. Call digimoncard.io external API for any missing names
--   Both steps happen sequentially after the main fetch, causing a noticeable lag.
--
-- Fix 1: Add card_name to v_top_cards_by_month via a LEFT JOIN to
--   decklist_card_metadata (which has a `name` column since 20260320_extend_decklist_card_metadata).
--   The join happens after the GROUP BY aggregation (one row per card_code),
--   so it adds exactly one lookup per unique card — not per raw join row.
--
-- Fix 2: Replace the generic idx_top8_results partial index with a tighter
--   idx_top4_results (placement <= 4), matching the exact WHERE predicate used
--   by both Top Cards views. The old index (placement <= 8) covers more rows
--   than needed and is less selective for this query.

BEGIN;

-- ─── 1. Recreate v_top_cards_by_month with card_name ──────────────────────────

DROP VIEW IF EXISTS public.v_top_cards_by_month;

CREATE VIEW public.v_top_cards_by_month
WITH (security_invoker = true)
AS
WITH base AS (
    SELECT
        date_trunc('month', tr.tournament_date::timestamp with time zone) AS month,
        tr.placement,
        dl.id                                                              AS decklist_id,
        dc.card_code,
        dc.card_type,
        dc.card_level,
        dc.is_digi_egg,
        dc.is_staple
    FROM  public.tournament_results tr
    JOIN  public.decklists          dl  ON dl.tournament_result_id = tr.id
    JOIN  public.decklist_cards     dc  ON dc.decklist_id          = dl.id
    WHERE tr.placement <= 4
),
agg AS (
    SELECT
        b.month,
        b.card_code,
        MAX(b.card_type)  FILTER (WHERE b.card_type IS NOT NULL) AS card_type,
        MAX(b.card_level)                                         AS card_level,
        BOOL_OR(b.is_digi_egg)                                    AS is_digi_egg,
        BOOL_OR(b.is_staple)                                      AS is_staple,
        COUNT(DISTINCT b.decklist_id)                                               AS total,
        COUNT(DISTINCT CASE WHEN b.placement = 1  THEN b.decklist_id END)           AS champion,
        COUNT(DISTINCT CASE WHEN b.placement <= 2 THEN b.decklist_id END)           AS top2,
        COUNT(DISTINCT CASE WHEN b.placement <= 3 THEN b.decklist_id END)           AS top3,
        COUNT(DISTINCT CASE WHEN b.placement <= 4 THEN b.decklist_id END)           AS top4
    FROM base b
    GROUP BY b.month, b.card_code
)
SELECT
    a.month,
    a.card_code,
    -- card_name is resolved server-side; client no longer needs cards_cache or external API.
    -- Falls back to card_code when decklist_card_metadata has no name yet.
    COALESCE(NULLIF(trim(meta.name), ''), a.card_code)  AS card_name,
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
LEFT JOIN public.decklist_card_metadata meta ON meta.card_code = a.card_code
ORDER BY a.month DESC, monthly_rank, a.card_code;

COMMENT ON VIEW public.v_top_cards_by_month IS
    'Top-4 card usage aggregated per month. '
    'card_name is resolved via decklist_card_metadata so the client does not need '
    'to fetch cards_cache or call digimoncard.io. '
    'Falls back to card_code when name is missing.';

GRANT ALL ON TABLE public.v_top_cards_by_month TO anon;
GRANT ALL ON TABLE public.v_top_cards_by_month TO authenticated;
GRANT ALL ON TABLE public.v_top_cards_by_month TO service_role;

-- ─── 2. Replace placement index with a tighter partial index ──────────────────
-- The existing idx_top8_results covers placement <= 8, which is less selective
-- than the <= 4 filter used by the Top Cards views.

DROP INDEX IF EXISTS public.idx_top8_results;

CREATE INDEX idx_top4_results
    ON public.tournament_results (placement)
    WHERE placement <= 4;

COMMIT;
