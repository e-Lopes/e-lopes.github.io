-- Migration: create v_top_cards_by_deck SQL view
-- Powers the "filter Top Cards by deck" feature in the statistics panel.
-- Returns one row per (deck_name, card_code) with Top-4 usage counts.
--
-- Join chain:
--   tournament_results -> decks (deck archetype name)
--   tournament_results -> decklists (via tournament_result_id)
--   decklists -> decklist_cards (the actual card list)
--   decklist_cards -> decklist_card_metadata (card catalog, keyed by card_code)

DROP VIEW IF EXISTS public.v_top_cards_by_deck;

CREATE OR REPLACE VIEW public.v_top_cards_by_deck
WITH (security_invoker = true)
AS
SELECT
    d.name                                                          AS deck_name,
    dc.card_code,
    -- Prefer a stored name from the card catalog; fall back to the card code.
    COALESCE(MAX(NULLIF(trim(meta.name), '')), dc.card_code)        AS card_name,
    MAX(meta.card_level)                                            AS card_level,
    MAX(meta.card_type)                                             AS card_type,
    bool_or(COALESCE(meta.is_staple, false))                        AS is_staple,
    -- Count distinct tournament_results rows (= distinct decklists) that
    -- contain the card. Matches the semantics of v_top_cards_by_month.
    count(DISTINCT tr.id)                                           AS total,
    count(DISTINCT CASE WHEN tr.placement = 1 THEN tr.id END)       AS champion,
    count(DISTINCT CASE WHEN tr.placement <= 2 THEN tr.id END)      AS top2,
    count(DISTINCT CASE WHEN tr.placement <= 3 THEN tr.id END)      AS top3,
    count(DISTINCT CASE WHEN tr.placement <= 4 THEN tr.id END)      AS top4
FROM public.tournament_results tr
JOIN public.decks d ON d.id = tr.deck_id
JOIN public.decklists dl ON dl.tournament_result_id = tr.id
JOIN public.decklist_cards dc ON dc.decklist_id = dl.id
LEFT JOIN public.decklist_card_metadata meta ON meta.card_code = dc.card_code
WHERE tr.placement BETWEEN 1 AND 4
  AND dc.card_code IS NOT NULL
GROUP BY d.name, dc.card_code
ORDER BY d.name, champion DESC, top4 DESC, total DESC;

COMMENT ON VIEW public.v_top_cards_by_deck IS
    'Top-4 card usage aggregated per deck archetype. '
    'One row per (deck_name, card_code). '
    'Use deck_name=eq.<name> to filter to a specific deck in the statistics panel.';
