ALTER TABLE tasks ADD COLUMN IF NOT EXISTS urgency text DEFAULT 'normal';
