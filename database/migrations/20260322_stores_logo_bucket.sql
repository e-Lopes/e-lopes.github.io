-- Migration: 2026-03-22
-- Add logo_url column to stores table and create store-logos storage bucket.
--
-- Run this in Supabase SQL Editor before using the Store logo upload in Admin.

BEGIN;

-- ─── 1. Add logo_url and is_active columns to stores (idempotent) ────────────
ALTER TABLE public.stores
    ADD COLUMN IF NOT EXISTS logo_url  text,
    ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

COMMIT;

-- ─── 2. Populate logo_url from store-logos bucket (run after bucket upload) ──
-- UPDATE public.stores
-- SET logo_url = CASE
--     WHEN lower(name) LIKE '%gladiator%'
--         THEN 'https://<project>.supabase.co/storage/v1/object/public/store-logos/Gladiators.png'
--     WHEN lower(name) LIKE '%cartinhas%' OR lower(name) LIKE '%celta%'
--         THEN 'https://<project>.supabase.co/storage/v1/object/public/store-logos/ReiDasCartinhas.png'
--     WHEN lower(name) LIKE '%meruru%'
--         THEN 'https://<project>.supabase.co/storage/v1/object/public/store-logos/Meruru.svg'
--     WHEN lower(name) LIKE '%taverna%'
--         THEN 'https://<project>.supabase.co/storage/v1/object/public/store-logos/Taverna.png'
--     WHEN lower(name) LIKE '%tcgbr%' OR lower(name) LIKE '%tcg br%'
--         THEN 'https://<project>.supabase.co/storage/v1/object/public/store-logos/TCGBR.png'
--     ELSE logo_url
-- END
-- WHERE logo_url IS NULL;

-- ─── 2. Storage bucket — run separately in Supabase Dashboard or via API ─────
--
-- The storage bucket cannot be created via SQL. Create it manually:
--
--   Dashboard → Storage → New bucket
--     Name:   store-logos
--     Public: true
--
-- Then add this RLS policy so authenticated users can upload:
--
--   INSERT INTO storage.objects (bucket_id, name, ...) — allow for authenticated
--
-- Or use the Supabase Storage API / dashboard policy editor:
--   Bucket: store-logos
--   Policy name: Allow authenticated uploads
--   Operations: INSERT, UPDATE, DELETE
--   Role: authenticated
--   Policy: true
--
--   Read (SELECT) policy:
--   Policy name: Public read
--   Operations: SELECT
--   Role: public (anon)
--   Policy: true
