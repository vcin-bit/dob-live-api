CREATE TABLE IF NOT EXISTS public.distribution_recipients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  site_id    uuid NOT NULL,
  name       text,
  unit_ref   text,
  email      text NOT NULL,
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_distribution_recipients_site ON public.distribution_recipients (site_id);
CREATE INDEX IF NOT EXISTS idx_distribution_recipients_company ON public.distribution_recipients (company_id);

ALTER TABLE public.distribution_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY distribution_recipients_service ON public.distribution_recipients
  AS PERMISSIVE FOR ALL TO service_role
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');
