
-- Site Playbook: the virtual supervisor config per site
CREATE TABLE IF NOT EXISTS site_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE UNIQUE,
  patrol_frequency_hours numeric(4,1) DEFAULT 2,
  patrol_type text DEFAULT 'Physical perimeter patrol',
  patrol_reminder_minutes int[] DEFAULT '{15,10,5}',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Scheduled tasks that fire at set times during a shift
CREATE TABLE IF NOT EXISTS site_scheduled_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  task_type text DEFAULT 'TASK', -- TASK, WELFARE_CALL, CCTV_CHECK, BUILDING_CHECK
  scheduled_time time, -- e.g. 02:00, 23:30 (null = patrol-triggered)
  days_of_week int[] DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sun, 6=Sat
  contact_name text, -- for welfare calls
  contact_phone text,
  escalate_after_minutes int DEFAULT 15,
  active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Standing checks: items that appear on every handover checklist
CREATE TABLE IF NOT EXISTS site_standing_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  description text NOT NULL,
  active boolean DEFAULT true,
  sort_order int DEFAULT 0
);

