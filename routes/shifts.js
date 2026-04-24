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
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
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
router.patch('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const allowed = ['site_id', 'officer_id', 'start_time', 'end_time', 'status', 'pay_rate', 'charge_rate', 'notes', 'checked_out_at'];
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

// POST /api/shifts/expire — auto-expire shifts past their end_time (called by cron)
router.post('/expire', async (req, res, next) => {
  try {
    const secret = req.headers['x-cron-secret'];
    if (secret !== process.env.CRON_SECRET && process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorised' });
    }
    const { data, error } = await supabase
      .from('shifts')
      .update({ status: 'COMPLETED', checked_out_at: new Date().toISOString() })
      .eq('status', 'ACTIVE')
      .lt('end_time', new Date().toISOString())
      .not('end_time', 'is', null)
      .select('id, officer_id, end_time');
    if (error) throw error;
    console.log(`Auto-expired ${data?.length || 0} shifts`);
    res.json({ expired: data?.length || 0, shifts: data });
  } catch (err) { next(err); }
});

// POST /api/shifts/start — officer starts an ad-hoc shift
router.post('/start', authenticate, async (req, res, next) => {
  try {
    const { site_id, lat, lng, end_time } = req.body;
    if (!site_id) return res.status(400).json({ error: 'site_id required' });

// POST /api/shifts/:id/checkin — officer checks in
router.post('/:id/checkin', authenticate, async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    const { data, error } = await supabase
      .from('shifts')
      .update({
        status: 'ACTIVE',
        checked_in_at: new Date().toISOString(),
        check_in_lat: lat || null,
        check_in_lng: lng || null,
      })
      .eq('id', req.params.id)
      .eq('officer_id', req.user.id)
      .select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/shifts/:id/checkout — officer checks out
router.post('/:id/checkout', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('shifts')
      .update({
        status: 'COMPLETED',
        checked_out_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('officer_id', req.user.id)
      .select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});


    // Check no active shift already
    const { data: existing } = await supabase
      .from('shifts')
      .select('id')
      .eq('officer_id', req.user.id)
      .eq('status', 'ACTIVE')
      .single();
    if (existing) return res.status(400).json({ error: 'You already have an active shift' });

    const { data, error } = await supabase
      .from('shifts')
      .insert({
        company_id: req.user.company_id,
        site_id,
        officer_id: req.user.id,
        start_time: new Date().toISOString(),
        status: 'ACTIVE',
        checked_in_at: new Date().toISOString(),
        check_in_lat: lat || null,
        check_in_lng: lng || null,
        end_time: end_time || null,
      })
      .select('*, site:sites(id,name)')
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// POST /api/shifts/expire — auto-expire shifts past their end_time (called by cron)
router.post('/expire', async (req, res, next) => {
  try {
    const secret = req.headers['x-cron-secret'];
    if (secret !== process.env.CRON_SECRET && process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorised' });
    }
    const { data, error } = await supabase
      .from('shifts')
      .update({ status: 'COMPLETED', checked_out_at: new Date().toISOString() })
      .eq('status', 'ACTIVE')
      .lt('end_time', new Date().toISOString())
      .not('end_time', 'is', null)
      .select('id, officer_id, end_time');
    if (error) throw error;
    console.log(`Auto-expired ${data?.length || 0} shifts`);
    res.json({ expired: data?.length || 0, shifts: data });
  } catch (err) { next(err); }
});

// DELETE /api/shifts/:id
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN','COMPANY','OPS_MANAGER','FD'), async (req, res, next) => {
  try {
    const { error } = await supabase.from('shifts').delete()
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
