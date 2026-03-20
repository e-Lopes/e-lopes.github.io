-- Migration: 2026-03-20
-- Add storage RLS policies for the post-backgrounds bucket
-- Required for the admin panel to upload format background images

-- Allow anon to upload (INSERT)
CREATE POLICY "Allow anon upload to post-backgrounds"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'post-backgrounds');

-- Allow anon to update (overwrite with x-upsert)
CREATE POLICY "Allow anon update post-backgrounds"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'post-backgrounds')
WITH CHECK (bucket_id = 'post-backgrounds');

-- Allow public read (SELECT) — needed so background_url is publicly accessible
CREATE POLICY "Allow public read post-backgrounds"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-backgrounds');

-- Allow anon to delete
CREATE POLICY "Allow anon delete post-backgrounds"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'post-backgrounds');
