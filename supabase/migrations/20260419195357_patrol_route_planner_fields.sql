
ALTER TABLE named_patrol_checkpoints ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE named_patrol_checkpoints ADD COLUMN IF NOT EXISTS what_to_look_for text;
ALTER TABLE named_patrol_routes ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE named_patrol_routes ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);

