
ALTER TABLE users ADD COLUMN IF NOT EXISTS sia_licence_type text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sia_licence_type_2 text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sia_licence_number_2 text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sia_expiry_date_2 date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bs7858_clearance_date date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bs7858_expiry_date date;

