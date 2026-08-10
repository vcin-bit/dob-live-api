
-- Officer HR self-service table
CREATE TABLE IF NOT EXISTS officer_hr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Next of Kin
  nok_name TEXT,
  nok_relationship TEXT,
  nok_phone TEXT,
  
  -- Personal
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  postcode TEXT,
  date_of_birth DATE,
  ni_number TEXT,
  
  -- Document paths (private storage)
  sia_front_path TEXT,
  sia_back_path TEXT,
  dbs_certificate_path TEXT,
  
  -- GDPR
  gdpr_consent BOOLEAN DEFAULT FALSE,
  gdpr_consent_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT officer_hr_user_id_key UNIQUE (user_id)
);

-- Index for company lookups
CREATE INDEX IF NOT EXISTS idx_officer_hr_company ON officer_hr(company_id);

-- RLS
ALTER TABLE officer_hr ENABLE ROW LEVEL SECURITY;

-- Officers can read/write their own record
CREATE POLICY "officer_hr_self" ON officer_hr
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role bypass (for API)
CREATE POLICY "officer_hr_service" ON officer_hr
  FOR ALL USING (true)
  WITH CHECK (true);

