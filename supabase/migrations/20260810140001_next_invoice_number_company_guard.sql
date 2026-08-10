-- Replace next_invoice_number with a version that guards against cross-company calls.
-- Non-service-role callers must supply their own company_id or the function raises.
-- The error message does not include the caller's or the supplied company id.
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_company_id uuid)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  next_num integer;
BEGIN
  -- Company guard: service_role callers (server-side API) are trusted.
  -- All other callers must be acting for their own company.
  IF current_role <> 'service_role' THEN
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
