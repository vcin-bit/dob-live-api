
ALTER TABLE sites ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS postcode text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS escalation_contact_1_name text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS escalation_contact_1_mobile text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS escalation_contact_2_name text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS escalation_contact_2_mobile text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS geofence_radius integer DEFAULT 500;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS notes text;

