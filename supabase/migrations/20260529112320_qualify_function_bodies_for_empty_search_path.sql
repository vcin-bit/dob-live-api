CREATE OR REPLACE FUNCTION public.current_user_company_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = ''
AS $function$
  SELECT company_id FROM public.users
  WHERE clerk_id = auth.jwt() ->> 'sub'
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_role()
  RETURNS user_role
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = ''
AS $function$
  SELECT role FROM public.users
  WHERE clerk_id = auth.jwt() ->> 'sub'
  LIMIT 1;
$function$;
