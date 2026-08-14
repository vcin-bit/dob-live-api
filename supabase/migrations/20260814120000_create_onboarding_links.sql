-- Create public.onboarding_links
CREATE TABLE public.onboarding_links (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid        NOT NULL REFERENCES public.companies(id),
  user_id         uuid        NOT NULL REFERENCES public.users(id),
  token           text        NOT NULL UNIQUE,
  created_by      uuid        NULL REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  opened_at       timestamptz NULL,
  last_seen_at    timestamptz NULL,
  completed_at    timestamptz NULL,
  revoked_at      timestamptz NULL,
  sent_to_phone   text        NULL,
  sent_to_email   text        NULL,
  send_count      integer     NOT NULL DEFAULT 0
);

-- One live link per user at a time (live = not revoked and not completed)
CREATE UNIQUE INDEX onboarding_links_user_live_uniq
  ON public.onboarding_links (user_id)
  WHERE revoked_at IS NULL AND completed_at IS NULL;

CREATE INDEX onboarding_links_token_idx
  ON public.onboarding_links (token);

CREATE INDEX onboarding_links_company_completed_idx
  ON public.onboarding_links (company_id, completed_at);

-- RLS
ALTER TABLE public.onboarding_links ENABLE ROW LEVEL SECURITY;

-- Company isolation — mirrors shifts exactly (USING + WITH CHECK)
CREATE POLICY onboarding_links_company_isolation
  ON public.onboarding_links
  FOR ALL
  USING (company_id = public.current_user_company_id())
  WITH CHECK (company_id = public.current_user_company_id());

-- Service role bypass — tightened pattern from fix_always_true_policies (officer_hr)
CREATE POLICY service_role_onboarding_links
  ON public.onboarding_links
  AS PERMISSIVE FOR ALL TO service_role
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- No access for anon or authenticated — all access via service role API
REVOKE ALL ON public.onboarding_links FROM anon, authenticated;

-- Add columns to public.officer_hr
ALTER TABLE public.officer_hr
  ADD COLUMN IF NOT EXISTS onboarding_link_id uuid        NULL REFERENCES public.onboarding_links(id),
  ADD COLUMN IF NOT EXISTS last_prompted_at    timestamptz NULL;
