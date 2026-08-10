
CREATE TABLE IF NOT EXISTS property_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  site_id UUID NOT NULL REFERENCES sites(id),
  inspector_id UUID NOT NULL REFERENCES users(id),
  inspector_name TEXT NOT NULL,
  site_name TEXT NOT NULL,
  client_name TEXT DEFAULT 'Aldi Stores Ltd',
  new_to_report BOOLEAN DEFAULT FALSE,
  categories TEXT[] DEFAULT '{}',
  summary TEXT,
  action_points TEXT,
  immediate_action BOOLEAN DEFAULT FALSE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  media JSONB DEFAULT '[]',
  pdf_path TEXT,
  inspected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_property_inspections_site ON property_inspections(site_id);
CREATE INDEX idx_property_inspections_company ON property_inspections(company_id);

ALTER TABLE property_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "property_inspections_service" ON property_inspections FOR ALL USING (true) WITH CHECK (true);

