ALTER TABLE public.officer_hr
  ADD COLUMN IF NOT EXISTS invoices_via_company boolean NULL;
