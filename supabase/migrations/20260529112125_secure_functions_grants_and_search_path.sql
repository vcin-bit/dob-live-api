-- Tighten grants: company_id + role functions usable by authenticated + service_role only
REVOKE EXECUTE ON FUNCTION public.current_user_company_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon, public;
-- rls_auto_enable: service_role only
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, public, authenticated;
-- Immutable search_path
ALTER FUNCTION public.current_user_company_id() SET search_path = '';
ALTER FUNCTION public.current_user_role() SET search_path = '';
ALTER FUNCTION public.update_updated_at() SET search_path = '';
