
ALTER TABLE sites ADD COLUMN IF NOT EXISTS client_portal_enabled boolean DEFAULT false;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS client_portal_pin text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS client_contact_name text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS client_contact_email text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS client_contact_phone text;

