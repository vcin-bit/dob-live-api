-- ACS Compliance Module Database Schema
-- For Risk Secured Ltd ACS certification preparation

-- Core ACS framework tables
CREATE TABLE acs_criteria (
  id SERIAL PRIMARY KEY,
  criterion_number INTEGER NOT NULL,
  criterion_name TEXT NOT NULL,
  total_indicators INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  description TEXT
);

CREATE TABLE acs_indicators (
  id SERIAL PRIMARY KEY,
  criterion_id INTEGER REFERENCES acs_criteria(id),
  indicator_code TEXT NOT NULL,
  indicator_text TEXT NOT NULL,
  required BOOLEAN DEFAULT true,
  evidence_requirements TEXT[]
);

CREATE TABLE company_acs_assessment (
  id SERIAL PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  indicator_id INTEGER REFERENCES acs_indicators(id),
  your_level INTEGER DEFAULT 0 CHECK (your_level >= 0 AND your_level <= 3),
  assessor_level INTEGER CHECK (assessor_level >= 0 AND assessor_level <= 3),
  evidence_notes TEXT,
  evidence_files TEXT[],
  compliance_status TEXT DEFAULT 'not_started' CHECK (compliance_status IN ('not_started', 'in_progress', 'completed', 'needs_review')),
  target_completion_date DATE,
  last_updated TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  UNIQUE(company_id, indicator_id)
);

CREATE TABLE acs_documents (
  id SERIAL PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  content TEXT,
  file_path TEXT,
  acs_indicators INTEGER[] DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  effective_date DATE,
  review_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE acs_evidence (
  id SERIAL PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  indicator_id INTEGER REFERENCES acs_indicators(id),
  evidence_type TEXT NOT NULL,
  evidence_source TEXT NOT NULL,
  source_table TEXT,
  source_query JSONB,
  file_path TEXT,
  description TEXT,
  collection_date TIMESTAMP DEFAULT NOW(),
  expiry_date TIMESTAMP,
  auto_renewable BOOLEAN DEFAULT false
);

CREATE TABLE acs_renewals (
  id SERIAL PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  item_type TEXT NOT NULL,
  item_id UUID,
  item_name TEXT NOT NULL,
  current_expiry_date DATE NOT NULL,
  renewal_frequency_months INTEGER DEFAULT 12,
  alert_days_before INTEGER[] DEFAULT '{30,14,7,1}',
  responsible_user UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE acs_audit_log (
  id SERIAL PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  old_values JSONB,
  new_values JSONB,
  notes TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Insert the 7 ACS criteria
INSERT INTO acs_criteria (criterion_number, criterion_name, total_indicators, max_score, description) VALUES
(1, 'Strategy', 11, 21, 'Business strategy, planning, and stakeholder communication'),
(2, 'Service delivery', 13, 15, 'Service processes, customer requirements, and performance'),
(3, 'Commercial relationship management', 9, 18, 'Customer relationships, purchasing, and business development'),
(4, 'Financial management', 7, 15, 'Financial controls, funding, and performance monitoring'),
(5, 'Resource management', 7, 11, 'Document control, premises, equipment, and technology'),
(6, 'People', 24, 52, 'Recruitment, training, development, and performance management'),
(7, 'Leadership', 7, 13, 'Leadership skills, ethics, and continuous improvement');

-- Insert Strategy indicators (Criterion 1)
INSERT INTO acs_indicators (criterion_id, indicator_code, indicator_text, evidence_requirements) VALUES
(1, '1.1.1', 'The organisation has a clear approach to business that is acted on and communicated to all staff', '{"Business strategy document","Staff communication records","Training completion records"}'),
(1, '1.1.2', 'Key stakeholders are aware of the organisation''s overall approach to business', '{"Stakeholder communication plan","Meeting minutes","Feedback records"}'),
(1, '1.1.3', 'A plan for the business exists with an effective review schedule', '{"Business plan","Review schedule","Performance monitoring"}');

-- RLS policies for compliance data
ALTER TABLE company_acs_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE acs_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE acs_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE acs_renewals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_acs_assessment" ON company_acs_assessment
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "service_role_full_access_acs_documents" ON acs_documents
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "service_role_full_access_acs_evidence" ON acs_evidence
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "service_role_full_access_acs_renewals" ON acs_renewals
  FOR ALL USING (current_setting('role') = 'service_role');
