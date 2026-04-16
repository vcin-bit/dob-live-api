const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/shifts
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { site_id, officer_id, status, from, to } = req.query;

    let query = supabase
      .from('shifts')
      .select(`*, officer:users(id, first_name, last_name), site:sites(id, name)`)
      .eq('company_id', req.user.company_id)
      .order('start_time', { ascending: false });

    if (site_id)   query = query.eq('site_id', site_id);
    if (status)    query = query.eq('status', status);
    if (from)      query = query.gte('start_time', from);
    if (to)        query = query.lte('start_time', to);

    if (req.user.role === 'OFFICER') {
      query = query.eq('officer_id', req.user.id);
    } else if (officer_id) {
      query = query.eq('officer_id', officer_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/shifts/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('shifts')
      .select(`*, officer:users(id, first_name, last_name), site:sites(id, name)`)
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Shift not found' });
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/shifts
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const { site_id, officer_id, start_time, end_time, pay_rate, charge_rate, notes } = req.body;
    const { data, error } = await supabase
      .from('shifts')
      .insert({ company_id: req.user.company_id, site_id, officer_id, start_time, end_time, pay_rate, charge_rate, notes })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PATCH /api/shifts/:id
router.patch('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const allowed = ['site_id', 'officer_id', 'start_time', 'end_time', 'status', 'pay_rate', 'charge_rate', 'notes'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase
      .from('shifts')
      .update(updates)
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .select()
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
