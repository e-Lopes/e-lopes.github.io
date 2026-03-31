-- Fix legacy background_url and background_path that include the old /formats/ subfolder
-- The bucket was restructured: files moved from post-backgrounds/formats/ to post-backgrounds/
-- This migration normalizes any remaining records that still reference the old path.

UPDATE formats
SET
    background_url  = REPLACE(background_url,  '/post-backgrounds/formats/', '/post-backgrounds/'),
    background_path = REPLACE(background_path, 'formats/', '')
WHERE
    background_url  LIKE '%/post-backgrounds/formats/%'
    OR background_path LIKE 'formats/%';
