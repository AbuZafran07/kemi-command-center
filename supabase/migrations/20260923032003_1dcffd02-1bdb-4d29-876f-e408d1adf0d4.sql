DROP POLICY IF EXISTS "agents_select_authenticated" ON public.agents;
CREATE POLICY "agents_select_authenticated" ON public.agents
  FOR SELECT TO authenticated
  USING (
    is_active = true
    OR public.has_role(auth.uid(), 'CEO'::public.app_role)
    OR public.has_role(auth.uid(), 'Director'::public.app_role)
  );

DROP POLICY IF EXISTS "data_classifications_select_authenticated" ON public.data_classifications;
CREATE POLICY "data_classifications_select_authenticated" ON public.data_classifications
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS "data_sources_select_authenticated" ON public.data_sources;
CREATE POLICY "data_sources_select_authenticated" ON public.data_sources
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS "sensitive_actions_select_authenticated" ON public.sensitive_actions;
CREATE POLICY "sensitive_actions_select_authenticated" ON public.sensitive_actions
  FOR SELECT TO authenticated
  USING (
    is_active = true
    OR public.has_role(auth.uid(), 'CEO'::public.app_role)
    OR public.has_role(auth.uid(), 'Director'::public.app_role)
  );

DROP POLICY IF EXISTS "user_avatars_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "user_avatars_select_public" ON storage.objects;
CREATE POLICY "user_avatars_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );