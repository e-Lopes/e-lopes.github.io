-- Migration: 2026-03-22
-- Add logo_url column to stores table and create store-logos storage bucket.
--
-- Run this in Supabase SQL Editor before using the Store logo upload in Admin.

BEGIN;

-- ─── 1. Add logo_url column to stores (idempotent) ───────────────────────────
ALTER TABLE public.stores
    ADD COLUMN IF NOT EXISTS logo_url text;

COMMIT;

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
