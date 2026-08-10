-- Counter table (mirrors company_card_counters exactly)
CREATE TABLE public.company_invoice_counters (
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  last_number integer     NOT NULL DEFAULT 0,
  updated_at  timestamptz DEFAULT now(),
  PRIMARY KEY (company_id)
);

ALTER TABLE public.company_invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_invoice_counters_company_access
  ON public.company_invoice_counters
  FOR ALL USING (company_id = public.current_user_company_id());

CREATE POLICY service_role_company_invoice_counters
  ON public.company_invoice_counters
  FOR ALL TO service_role USING (true);

-- Seed counter rows for existing companies
INSERT INTO public.company_invoice_counters (company_id, last_number)
SELECT id, 0 FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

-- Atomic invoice number allocator.
-- Uses upsert with RETURNING so two concurrent calls cannot get the same number.
-- Empty search_path and fully qualified names per secure_functions_grants_and_search_path.
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_company_id uuid)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  next_num integer;
BEGIN
  INSERT INTO public.company_invoice_counters (company_id, last_number, updated_at)
  VALUES (p_company_id, 1, now())
  ON CONFLICT (company_id) DO UPDATE
    SET last_number = public.company_invoice_counters.last_number + 1,
        updated_at  = now()
  RETURNING last_number INTO next_num;

  RETURN 'RS-SB-' || LPAD(next_num::text, 5, '0');
END;
$$;

-- Restrict to authenticated and service_role; anon cannot allocate invoice numbers
REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid) FROM anon, public;

-- Self-billing invoice records.
-- Contractor fields are snapshotted at issue time so historic invoices remain
-- accurate even if the officer later changes their company name, VAT number, or UTR.
CREATE TABLE public.self_bill_invoices (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid        NOT NULL REFERENCES public.companies(id),
  officer_id              uuid        NOT NULL REFERENCES public.users(id),
  invoice_number          text        NOT NULL,
  period_start            date        NOT NULL,
  period_end              date        NOT NULL,
  total_hours             numeric     NOT NULL,
  total_amount            numeric     NOT NULL,
  vat_amount              numeric     NULL,
  contractor_name         text        NOT NULL,
  contractor_company_name text        NULL,
  contractor_vat_number   text        NULL,
  contractor_utr          text        NULL,
  shift_ids               uuid[]      NOT NULL,
  pdf_path                text        NULL,
  sent_to                 text        NOT NULL,
  sent_cc                 text        NULL,
  sent_at                 timestamptz NOT NULL DEFAULT now(),
  created_by              uuid        NULL REFERENCES public.users(id),
  created_at              timestamptz DEFAULT now(),
  CONSTRAINT self_bill_invoices_company_invoice_unique
    UNIQUE (company_id, invoice_number)
);

CREATE INDEX idx_self_bill_invoices_company_sent
  ON public.self_bill_invoices (company_id, sent_at DESC);

CREATE INDEX idx_self_bill_invoices_officer_sent
  ON public.self_bill_invoices (officer_id, sent_at DESC);

ALTER TABLE public.self_bill_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY self_bill_invoices_company_isolation
  ON public.self_bill_invoices
  FOR ALL
  USING (company_id = public.current_user_company_id())
  WITH CHECK (company_id = public.current_user_company_id());

CREATE POLICY service_role_self_bill_invoices
  ON public.self_bill_invoices
  FOR ALL TO service_role USING (true);
