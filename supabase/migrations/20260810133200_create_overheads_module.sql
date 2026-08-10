-- Create public.overheads
CREATE TABLE public.overheads (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid        NOT NULL REFERENCES public.companies(id),
  site_id        uuid        NULL REFERENCES public.sites(id),
  category       text        NOT NULL
    CONSTRAINT overheads_category_check CHECK (
      category IN (
        'insurance','vehicles','fuel','uniform','equipment','software',
        'premises','professional_fees','training','licensing','salaries','other'
      )
    ),
  description    text        NOT NULL,
  amount         numeric     NOT NULL,
  frequency      text        NOT NULL
    CONSTRAINT overheads_frequency_check CHECK (
      frequency IN ('one_off','weekly','monthly','quarterly','annual')
    ),
  effective_from date        NOT NULL,
  effective_to   date        NULL,
  active         boolean     NOT NULL DEFAULT true,
  notes          text        NULL,
  created_at     timestamptz DEFAULT now(),
  created_by     uuid        NULL REFERENCES public.users(id)
);

-- Row level security — mirrors shifts_company_isolation, with WITH CHECK added
ALTER TABLE public.overheads ENABLE ROW LEVEL SECURITY;

CREATE POLICY overheads_company_isolation
  ON public.overheads
  FOR ALL
  USING (company_id = current_user_company_id())
  WITH CHECK (company_id = current_user_company_id());

-- Indexes
CREATE INDEX idx_overheads_company_active ON public.overheads (company_id, active);
CREATE INDEX idx_overheads_site_id        ON public.overheads (site_id);

-- View: overhead_weekly_cost (security_invoker respects RLS on overheads)
CREATE OR REPLACE VIEW public.overhead_weekly_cost
  WITH (security_invoker = true)
AS
SELECT
  id,
  company_id,
  site_id,
  category,
  description,
  frequency,
  amount,
  CASE frequency
    WHEN 'weekly'    THEN amount
    WHEN 'monthly'   THEN amount * 12 / 52
    WHEN 'quarterly' THEN amount * 4  / 52
    WHEN 'annual'    THEN amount      / 52
    WHEN 'one_off'   THEN NULL
  END AS weekly_amount,
  effective_from,
  effective_to
FROM public.overheads
WHERE active = true
  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  AND effective_from <= CURRENT_DATE;
