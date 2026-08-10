CREATE TABLE IF NOT EXISTS public.site_tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL,
  site_id     uuid NOT NULL,
  unit_ref    text,
  tenant_name text NOT NULL,
  comments    text,
  status      text DEFAULT 'active',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_contacts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.site_tenants(id) ON DELETE CASCADE,
  position   integer DEFAULT 1,
  name       text,
  phone      text,
  email      text,
  label      text,
  notes      text,
  created_at timestamptz DEFAULT now()
);

-- Search + lookup indexes
CREATE INDEX IF NOT EXISTS idx_site_tenants_site ON public.site_tenants (site_id);
CREATE INDEX IF NOT EXISTS idx_site_tenants_company ON public.site_tenants (company_id);
CREATE INDEX IF NOT EXISTS idx_tenant_contacts_tenant ON public.tenant_contacts (tenant_id, position);

-- RLS: service-role only, matching the platform's hardened pattern
ALTER TABLE public.site_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_tenants_service ON public.site_tenants
  AS PERMISSIVE FOR ALL TO service_role
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY tenant_contacts_service ON public.tenant_contacts
  AS PERMISSIVE FOR ALL TO service_role
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');
