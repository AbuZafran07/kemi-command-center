REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_use_agent(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_agent(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;