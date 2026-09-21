-- Fase 8: self-service profile management + avatar storage.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Deny-by-default: a user may only write inside their own {auth.uid()}/ folder.
CREATE POLICY "user_avatars_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
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