
-- Site Instructions
CREATE TABLE IF NOT EXISTS site_instructions (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id    uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE UNIQUE,
  sections   jsonb NOT NULL DEFAULT '[]',
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Company Policies
CREATE TABLE IF NOT EXISTS company_policies (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  sections   jsonb NOT NULL DEFAULT '[]',
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Site Folders
CREATE TABLE IF NOT EXISTS site_folders (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id     uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);

-- Site Documents
CREATE TABLE IF NOT EXISTS site_documents (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  folder_id     uuid REFERENCES site_folders(id) ON DELETE SET NULL,
  name          text NOT NULL,
  original_name text,
  mime_type     text,
  file_size     integer DEFAULT 0,
  storage_path  text NOT NULL,
  uploaded_by   uuid REFERENCES users(id),
  created_at    timestamptz DEFAULT now()
);

-- Patrol Checkpoints (patrol_routes already exists)
CREATE TABLE IF NOT EXISTS patrol_checkpoints (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id     uuid NOT NULL REFERENCES patrol_routes(id) ON DELETE CASCADE,
  name         text NOT NULL,
  instructions text,
  lat          double precision,
  lng          double precision,
  order_index  integer DEFAULT 0,
  alert_sound  boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- Add missing columns to patrol_routes if needed
ALTER TABLE patrol_routes ADD COLUMN IF NOT EXISTS instructions text;
ALTER TABLE patrol_routes ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);

-- Shift Patterns
CREATE TABLE IF NOT EXISTS shift_patterns (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id           uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id              uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  days                 text[] NOT NULL DEFAULT '{}',
  start_time           text NOT NULL,
  end_time             text NOT NULL,
  required_officers    integer DEFAULT 1,
  charge_rate          numeric,
  pay_rate             numeric,
  bank_hol_charge_mult numeric DEFAULT 2,
  bank_hol_pay_mult    numeric DEFAULT 2,
  active               boolean DEFAULT true,
  notes                text,
  created_at           timestamptz DEFAULT now()
);

-- Officer Rates
CREATE TABLE IF NOT EXISTS officer_rates (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  officer_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id        uuid REFERENCES sites(id) ON DELETE SET NULL,
  hourly_rate    numeric NOT NULL,
  role_label     text DEFAULT '',
  effective_from timestamptz DEFAULT now(),
  effective_to   timestamptz,
  active         boolean DEFAULT true,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- Client Users
CREATE TABLE IF NOT EXISTS client_users (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id       uuid REFERENCES sites(id) ON DELETE SET NULL,
  name          text NOT NULL,
  email         text NOT NULL,
  password_hash text,
  active        boolean DEFAULT true,
  last_login    timestamptz,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (company_id, email)
);

-- Client Alerts
CREATE TABLE IF NOT EXISTS client_alerts (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id     uuid REFERENCES sites(id) ON DELETE SET NULL,
  title       text NOT NULL,
  description text,
  severity    text DEFAULT 'medium',
  status      text DEFAULT 'open',
  created_by  uuid REFERENCES users(id),
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

