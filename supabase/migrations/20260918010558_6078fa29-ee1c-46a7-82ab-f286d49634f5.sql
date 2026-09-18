REVOKE ALL ON FUNCTION public.build_daily_snapshot(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_daily_snapshot(date) TO service_role;