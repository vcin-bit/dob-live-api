
CREATE TABLE IF NOT EXISTS contract_lines (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id     uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        text NOT NULL,
  category    text DEFAULT 'other',
  description text,
  cost        numeric NOT NULL DEFAULT 0,
  charge      numeric NOT NULL DEFAULT 0,
  recurring   boolean DEFAULT true,
  start_date  date,
  end_date    date,
  active      boolean DEFAULT true,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contract_queries (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id      uuid REFERENCES sites(id) ON DELETE SET NULL,
  raised_by    uuid REFERENCES users(id),
  category     text DEFAULT 'other',
  subject      text NOT NULL,
  description  text NOT NULL,
  priority     text DEFAULT 'medium',
  status       text DEFAULT 'open',
  responses    jsonb DEFAULT '[]',
  resolved_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);

