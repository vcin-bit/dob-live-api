
-- Allow null officer_id and title for migrated logs
ALTER TABLE occurrence_logs ALTER COLUMN officer_id DROP NOT NULL;
ALTER TABLE occurrence_logs ALTER COLUMN title DROP NOT NULL;

-- Clean up duplicate companies from repeated migration runs, keep only the first
DELETE FROM companies 
WHERE id NOT IN (
  SELECT id FROM companies ORDER BY created_at ASC LIMIT 1
);

