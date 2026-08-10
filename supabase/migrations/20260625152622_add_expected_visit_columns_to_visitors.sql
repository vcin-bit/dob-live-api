ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS expected_date     date,
  ADD COLUMN IF NOT EXISTS expected_time     time,
  ADD COLUMN IF NOT EXISTS booking_group_id  uuid,
  ADD COLUMN IF NOT EXISTS arrival_photo_url text,
  ADD COLUMN IF NOT EXISTS created_by_source text,
  ADD COLUMN IF NOT EXISTS created_by        uuid;

-- Index to make the officer "expected today" query fast
CREATE INDEX IF NOT EXISTS idx_visitors_expected
  ON public.visitors (site_id, expected_date, status)
  WHERE status = 'expected';

-- Index for edit/cancel by booking group
CREATE INDEX IF NOT EXISTS idx_visitors_booking_group
  ON public.visitors (booking_group_id)
  WHERE booking_group_id IS NOT NULL;
