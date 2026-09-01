-- Pay basis correction: use rostered hours, not clocked hours.
--
-- Business rule: pay follows the roster. Guards clock on and off a few minutes
-- early or late; those variations are not paid and not deducted. Where hours
-- genuinely need changing, the roster itself is amended. actual_hours and
-- variance_hours are retained for attendance monitoring only. adjusted_hours
-- remains the manual override for cases where the roster cannot be corrected.
--
-- Old expression: COALESCE(adjusted_hours, actual_hours, rostered_hours)
-- New expression: COALESCE(adjusted_hours, rostered_hours)

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
    COALESCE(b.adjusted_hours, b.rostered_hours) AS payable_hours
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
