-- Fase 8: self-service profile management + avatar storage.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Public-read bucket; Storage itself rejects anything outside these types/size.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-avatars', 'user-avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Deny-by-default: a user may only write inside their own {auth.uid()}/ folder.
-- Reads are public (the bucket itself is public) so avatars render without auth.
CREATE POLICY "user_avatars_select_public" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'user-avatars');

CREATE POLICY "user_avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "user_avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "user_avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
