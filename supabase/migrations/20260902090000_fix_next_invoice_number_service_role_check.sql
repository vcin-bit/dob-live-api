-- Fix next_invoice_number: detect service_role from JWT claims, not current_role.
--
-- The previous guard used current_role <> 'service_role'. Because the function is
-- SECURITY DEFINER, current_role always returns the function owner (postgres), never
-- 'service_role', so the guard was always true and fell through to the company
-- comparison. The server API calls this via the service role key with no JWT user
-- context, so current_user_company_id() returns null, which is DISTINCT from any
-- real company_id, causing the "Access denied" exception on every invoice submission.
--
-- Fix: read the caller's role from the JWT claims instead.
-- coalesce(current_setting('request.jwt.claims', true)::json->>'role', '')
-- returns 'service_role' when called with the service role key, and '' when the
-- setting is absent (the true argument suppresses the missing-setting error).
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_company_id uuid)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  next_num  integer;
  jwt_role  text;
BEGIN
  -- Derive the caller's role from JWT claims rather than current_role.
  -- current_setting(..., true) returns '' rather than raising if the setting is absent.
  jwt_role := coalesce(
    current_setting('request.jwt.claims', true)::json->>'role',
    ''
  );

  -- Company guard: service_role callers (server-side API) are trusted unconditionally.
  -- All other callers must be acting for their own company.
  IF jwt_role <> 'service_role' THEN
    IF p_company_id IS DISTINCT FROM public.current_user_company_id() THEN
      RAISE EXCEPTION 'Access denied: invoice number may only be allocated for your own company';
    END IF;
  END IF;

  INSERT INTO public.company_invoice_counters (company_id, last_number, updated_at)
  VALUES (p_company_id, 1, now())
  ON CONFLICT (company_id) DO UPDATE
    SET last_number = public.company_invoice_counters.last_number + 1,
        updated_at  = now()
  RETURNING last_number INTO next_num;

  RETURN 'RS-SB-' || LPAD(next_num::text, 5, '0');
END;
$$;
