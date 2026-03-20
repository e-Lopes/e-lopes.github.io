-- Allow unlimited-card quantities (up to 50) in decklist_cards.
ALTER TABLE public.decklist_cards
    DROP CONSTRAINT IF EXISTS decklist_cards_qty_check;

ALTER TABLE public.decklist_cards
    ADD CONSTRAINT decklist_cards_qty_check CHECK ((qty >= 1) AND (qty <= 50));
