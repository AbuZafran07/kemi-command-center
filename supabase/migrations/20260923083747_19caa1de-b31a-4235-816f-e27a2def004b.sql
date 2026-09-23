DROP POLICY IF EXISTS "agent_avatars_select_authenticated" ON storage.objects;
CREATE POLICY "agent_avatars_select_super_admin"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'agent-avatars' AND private.has_role(auth.uid(), 'super_admin'));