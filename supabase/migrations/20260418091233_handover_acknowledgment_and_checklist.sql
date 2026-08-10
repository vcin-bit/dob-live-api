
-- Add acknowledgment, checklist, and AI fields to handover_briefs
ALTER TABLE handover_briefs
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS checklist jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ai_generated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'PENDING';

-- Add roster_locked flag to shifts
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS roster_locked boolean DEFAULT false;

