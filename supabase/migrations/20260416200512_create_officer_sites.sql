
CREATE TABLE officer_sites (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  officer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id    uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (officer_id, site_id)
);

