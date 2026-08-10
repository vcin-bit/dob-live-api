-- 1. Per-company prefix setting (default 'RS')
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS employee_number_prefix text NOT NULL DEFAULT 'RS';

-- 2. Employee number column on users (nullable; manual or auto)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS employee_number text;

-- 3. Unique per company (two companies may share 'RS-0001'; one company may not)
CREATE UNIQUE INDEX IF NOT EXISTS users_company_employee_number_uniq
  ON public.users (company_id, employee_number)
  WHERE employee_number IS NOT NULL;

-- 4. Per-company counter table
CREATE TABLE IF NOT EXISTS public.company_employee_counters (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_employee_counters ENABLE ROW LEVEL SECURITY;

-- 5. Atomic allocator: reserves the next number for a company and returns
--    the formatted employee number (e.g. 'RS-0001'). Never reuses a number,
--    even after a leaver. SECURITY DEFINER so it runs with table owner rights.
CREATE OR REPLACE FUNCTION public.allocate_employee_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_next   integer;
BEGIN
  -- Resolve the company's prefix (fallback 'RS')
  SELECT COALESCE(employee_number_prefix, 'RS')
    INTO v_prefix
    FROM public.companies
   WHERE id = p_company_id;

  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Unknown company_id %', p_company_id;
  END IF;

  -- Insert-or-increment the counter atomically; the row lock from
  -- ON CONFLICT DO UPDATE serialises concurrent allocations.
  INSERT INTO public.company_employee_counters (company_id, last_number)
       VALUES (p_company_id, 1)
  ON CONFLICT (company_id)
  DO UPDATE SET last_number = public.company_employee_counters.last_number + 1,
               updated_at  = now()
    RETURNING last_number INTO v_next;

  RETURN v_prefix || '-' || lpad(v_next::text, 4, '0');
END;
$$;

-- Allow the API roles to call the allocator
GRANT EXECUTE ON FUNCTION public.allocate_employee_number(uuid) TO authenticated, service_role, anon;
