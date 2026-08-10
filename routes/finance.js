const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// Service role key bypasses RLS — every query must filter by company_id.
const fdOnly = requireRole('SUPER_ADMIN', 'FD');

function round2(n) {
  if (n === null || n === undefined) return null;
  return Math.round(Number(n) * 100) / 100;
}

const PAY_LINE_SELECT = `
  id, company_id, site_id, officer_id,
  start_time, end_time, checked_in_at, checked_out_at,
  shift_type, approval_status,
  rostered_hours, actual_hours, variance_hours, payable_hours,
  pay_rate, charge_rate, bh_hours, bh_pay_rate, bh_charge_rate,
  pay_amount, charge_amount, margin_amount,
  officer:users(first_name, last_name),
  site:sites(name)
`.trim();

function roundPayLine(r) {
  return {
    ...r,
    rostered_hours: round2(r.rostered_hours),
    actual_hours:   round2(r.actual_hours),
    variance_hours: round2(r.variance_hours),
    payable_hours:  round2(r.payable_hours),
    pay_amount:     round2(r.pay_amount),
    charge_amount:  round2(r.charge_amount),
    margin_amount:  round2(r.margin_amount),
  };
}

// GET /api/finance/pay-lines
// Query params: from (required), to (required), site_id, officer_id, approval_status
router.get('/pay-lines', authenticate, fdOnly, async (req, res, next) => {
  try {
    const { from, to, site_id, officer_id, approval_status } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

    let query = supabase
      .from('shift_pay_lines')
      .select(PAY_LINE_SELECT)
      .eq('company_id', req.user.company_id)
      .gte('start_time', from)
      .lte('start_time', to)
      .order('start_time', { ascending: false })
      .limit(500);

    if (site_id)         query = query.eq('site_id', site_id);
    if (officer_id)      query = query.eq('officer_id', officer_id);
    if (approval_status) query = query.eq('approval_status', approval_status);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ data: data.map(roundPayLine) });
  } catch (err) { next(err); }
});

// GET /api/finance/summary
// Query params: from (required), to (required), site_id, officer_id
router.get('/summary', authenticate, fdOnly, async (req, res, next) => {
  try {
    const { from, to, site_id, officer_id } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

    let query = supabase
      .from('shift_pay_lines')
      .select('approval_status, site_id, rostered_hours, actual_hours, payable_hours, pay_amount, charge_amount, margin_amount, site:sites(name)')
      .eq('company_id', req.user.company_id)
      .gte('start_time', from)
      .lte('start_time', to);

    if (site_id)    query = query.eq('site_id', site_id);
    if (officer_id) query = query.eq('officer_id', officer_id);

    const { data, error } = await query;
    if (error) throw error;

    let totalRostered = 0, totalActual = 0, totalPayable = 0;
    let totalPay = 0, totalCharge = 0, totalMargin = 0;
    const byStatus = {};
    const siteMap = {};

    for (const r of data) {
      totalRostered += Number(r.rostered_hours) || 0;
      totalActual   += Number(r.actual_hours)   || 0;
      totalPayable  += Number(r.payable_hours)  || 0;
      totalPay      += Number(r.pay_amount)     || 0;
      totalCharge   += Number(r.charge_amount)  || 0;
      totalMargin   += Number(r.margin_amount)  || 0;

      byStatus[r.approval_status] = (byStatus[r.approval_status] || 0) + 1;

      if (!siteMap[r.site_id]) {
        siteMap[r.site_id] = {
          site_id:      r.site_id,
          site_name:    r.site?.name || null,
          payable_hours: 0,
          pay_amount:    0,
          charge_amount: 0,
          margin_amount: 0,
        };
      }
      siteMap[r.site_id].payable_hours  += Number(r.payable_hours)  || 0;
      siteMap[r.site_id].pay_amount     += Number(r.pay_amount)     || 0;
      siteMap[r.site_id].charge_amount  += Number(r.charge_amount)  || 0;
      siteMap[r.site_id].margin_amount  += Number(r.margin_amount)  || 0;
    }

    const by_site = Object.values(siteMap).map(s => ({
      ...s,
      payable_hours: round2(s.payable_hours),
      pay_amount:    round2(s.pay_amount),
      charge_amount: round2(s.charge_amount),
      margin_amount: round2(s.margin_amount),
    }));

    res.json({
      data: {
        total_rostered_hours: round2(totalRostered),
        total_actual_hours:   round2(totalActual),
        total_payable_hours:  round2(totalPayable),
        total_pay_amount:     round2(totalPay),
        total_charge_amount:  round2(totalCharge),
        total_margin_amount:  round2(totalMargin),
        shifts_by_status:     byStatus,
        by_site,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/finance/variances
// Returns shifts where |variance_hours| >= 15 min, or past shifts with missing clockings.
// Query params: from (required), to (required), site_id, officer_id
router.get('/variances', authenticate, fdOnly, async (req, res, next) => {
  try {
    const { from, to, site_id, officer_id } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

    let query = supabase
      .from('shift_pay_lines')
      .select(PAY_LINE_SELECT)
      .eq('company_id', req.user.company_id)
      .gte('start_time', from)
      .lte('start_time', to)
      .order('start_time', { ascending: false })
      .limit(500);

    if (site_id)    query = query.eq('site_id', site_id);
    if (officer_id) query = query.eq('officer_id', officer_id);

    const { data, error } = await query;
    if (error) throw error;

    const now = new Date();
    const FIFTEEN_MINS_IN_HOURS = 0.25;

    const flagged = data.filter(r => {
      const bigVariance = r.variance_hours !== null
        && Math.abs(Number(r.variance_hours)) >= FIFTEEN_MINS_IN_HOURS;
      const missingClockings = (r.checked_in_at === null || r.checked_out_at === null)
        && new Date(r.end_time) < now;
      return bigVariance || missingClockings;
    });

    res.json({ data: flagged.map(roundPayLine) });
  } catch (err) { next(err); }
});

module.exports = router;
