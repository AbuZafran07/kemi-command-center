
CREATE POLICY "agent_avatars_select_authenticated" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'agent-avatars');
CREATE POLICY "agent_avatars_insert_admin" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'agent-avatars' AND private.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "agent_avatars_update_admin" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'agent-avatars' AND private.has_role(auth.uid(), 'super_admin')) WITH CHECK (bucket_id = 'agent-avatars' AND private.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "agent_avatars_delete_admin" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'agent-avatars' AND private.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role FROM auth.users WHERE email = 'ferry@kemika.co.id'
ON CONFLICT (user_id, role) DO NOTHING;
