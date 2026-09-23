UPDATE public.agents SET is_active = true WHERE code = 'FINA';
INSERT INTO public.agent_permissions (role, agent_code, division, allowed) VALUES
  ('CEO','FINA','*',true),
  ('Director','FINA','*',true),
  ('Manager','FINA','Finance',true)
ON CONFLICT DO NOTHING;