
CREATE TABLE IF NOT EXISTS named_patrol_routes (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id     uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        text NOT NULL,
  instructions text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS named_patrol_checkpoints (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id    uuid NOT NULL REFERENCES named_patrol_routes(id) ON DELETE CASCADE,
  name        text NOT NULL,
  instructions text DEFAULT '',
  order_index int DEFAULT 0,
  lat         double precision,
  lng         double precision
);

