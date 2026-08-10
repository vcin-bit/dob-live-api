-- Add pay approval columns to public.shifts
ALTER TABLE public.shifts
  ADD COLUMN approval_status text NOT NULL DEFAULT 'pending'
    CONSTRAINT shifts_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'queried', 'excluded')),
  ADD COLUMN approved_by    uuid        NULL REFERENCES public.users(id),
  ADD COLUMN approved_at    timestamptz NULL,
  ADD COLUMN query_reason   text        NULL,
  ADD COLUMN adjusted_hours numeric     NULL;

-- Partial index for pending-approval queue
CREATE INDEX idx_shifts_pending_approval
  ON public.shifts (company_id, approval_status)
  WHERE approval_status = 'pending';

-- Bulk-approve all shifts that were already complete at go-live.
-- These are marked approved with no approver — they were closed off in bulk
-- at migration time, not individually reviewed, so approved_by / approved_at
-- are left null to distinguish them from human-approved records.
UPDATE public.shifts
  SET approval_status = 'approved'
  WHERE end_time < now()
    AND approval_status = 'pending';

-- View: shift_pay_lines (security_invoker respects RLS on public.shifts)
CREATE OR REPLACE VIEW public.shift_pay_lines
  WITH (security_invoker = true)
AS
WITH base AS (
  SELECT
    s.*,
    EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600 AS rostered_hours,
    CASE
      WHEN s.checked_in_at IS NOT NULL AND s.checked_out_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (s.checked_out_at - s.checked_in_at)) / 3600
    END AS actual_hours
  FROM public.shifts s
),
computed AS (
  SELECT
    b.*,
    b.actual_hours - b.rostered_hours AS variance_hours,
    COALESCE(b.adjusted_hours, b.actual_hours, b.rostered_hours) AS payable_hours
  FROM base b
)
SELECT
  c.id,
  c.company_id,
  c.site_id,
  c.officer_id,
  c.start_time,
  c.end_time,
  c.checked_in_at,
  c.checked_out_at,
  c.shift_type,
  c.approval_status,
  c.rostered_hours,
  c.actual_hours,
  c.variance_hours,
  c.payable_hours,
  c.pay_rate,
  c.charge_rate,
  c.bh_hours,
  c.bh_pay_rate,
  c.bh_charge_rate,
  c.payable_hours * COALESCE(c.pay_rate, 0)
    + COALESCE(c.bh_hours, 0) * COALESCE(c.bh_pay_rate, 0)    AS pay_amount,
  c.payable_hours * COALESCE(c.charge_rate, 0)
    + COALESCE(c.bh_hours, 0) * COALESCE(c.bh_charge_rate, 0) AS charge_amount,
  (c.payable_hours * COALESCE(c.charge_rate, 0)
    + COALESCE(c.bh_hours, 0) * COALESCE(c.bh_charge_rate, 0))
  - (c.payable_hours * COALESCE(c.pay_rate, 0)
    + COALESCE(c.bh_hours, 0) * COALESCE(c.bh_pay_rate, 0))   AS margin_amount
FROM computed c;
