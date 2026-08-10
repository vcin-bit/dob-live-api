
-- Site Assignment Instructions — the CURRENT/DRAFT version (one row per site)
CREATE TABLE site_assignment_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  site_id uuid NOT NULL REFERENCES sites(id),
  revision integer NOT NULL DEFAULT 0,
  title text NOT NULL DEFAULT 'Assignment Instructions',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_policies text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_by uuid REFERENCES users(id),
  published_at timestamptz,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(site_id)
);

-- Revision history — one row per published revision (immutable snapshots)
CREATE TABLE site_ai_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_id uuid NOT NULL REFERENCES site_assignment_instructions(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id),
  company_id uuid NOT NULL,
  revision integer NOT NULL,
  title text NOT NULL,
  sections jsonb NOT NULL,
  linked_policies text[] NOT NULL DEFAULT '{}',
  published_by uuid REFERENCES users(id),
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ai_id, revision)
);

-- Officer declarations — "I have read, understood and will comply"
CREATE TABLE site_ai_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_id uuid NOT NULL REFERENCES site_assignment_instructions(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id),
  user_id uuid NOT NULL REFERENCES users(id),
  revision integer NOT NULL,
  declared_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  UNIQUE(user_id, ai_id, revision)
);

-- Indexes for common queries
CREATE INDEX idx_sai_company ON site_assignment_instructions(company_id);
CREATE INDEX idx_sai_site ON site_assignment_instructions(site_id);
CREATE INDEX idx_ai_revisions_ai ON site_ai_revisions(ai_id);
CREATE INDEX idx_ai_revisions_site ON site_ai_revisions(site_id);
CREATE INDEX idx_ai_declarations_user ON site_ai_declarations(user_id);
CREATE INDEX idx_ai_declarations_site ON site_ai_declarations(site_id);
CREATE INDEX idx_ai_declarations_ai_rev ON site_ai_declarations(ai_id, revision);

-- RLS policies
ALTER TABLE site_assignment_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_ai_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_ai_declarations ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (API uses service role key)
CREATE POLICY "service_role_sai" ON site_assignment_instructions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_revisions" ON site_ai_revisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_declarations" ON site_ai_declarations FOR ALL USING (true) WITH CHECK (true);

