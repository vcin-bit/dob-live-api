
ALTER TABLE sites ADD COLUMN IF NOT EXISTS contract_start_date date;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS client_company_address text;

CREATE TABLE IF NOT EXISTS site_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  site_id uuid NOT NULL REFERENCES sites(id),
  label text NOT NULL,
  code text NOT NULL,
  code_type text NOT NULL DEFAULT 'keypad',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE site_codes ENABLE ROW LEVEL SECURITY;

