
CREATE TABLE IF NOT EXISTS visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  site_id uuid NOT NULL REFERENCES sites(id),
  shift_id uuid REFERENCES shifts(id),
  officer_id uuid REFERENCES users(id),
  visitor_name text NOT NULL,
  company_name text,
  who_visiting text,
  pass_number text,
  vehicle_reg text,
  personnel_count integer DEFAULT 1,
  visit_type text DEFAULT 'visitor',
  time_in timestamptz DEFAULT now(),
  time_out timestamptz,
  status text DEFAULT 'on_site',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS visitors_site_id_idx ON visitors(site_id);
CREATE INDEX IF NOT EXISTS visitors_status_idx ON visitors(status);

