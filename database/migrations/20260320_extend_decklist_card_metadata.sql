-- Migration: 2026-03-20
-- Extend decklist_card_metadata to replace cards_cache
-- Adds name, id, pack, color, card_payload columns

ALTER TABLE public.decklist_card_metadata
    ADD COLUMN IF NOT EXISTS id       text,
    ADD COLUMN IF NOT EXISTS name     text,
    ADD COLUMN IF NOT EXISTS pack     text,
    ADD COLUMN IF NOT EXISTS color    text,
    ADD COLUMN IF NOT EXISTS card_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
