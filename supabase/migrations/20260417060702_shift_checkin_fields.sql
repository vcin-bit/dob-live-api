
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS status text DEFAULT 'scheduled';
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS checked_out_at timestamptz;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS check_in_lat double precision;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS check_in_lng double precision;

