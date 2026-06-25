const crypto = require('crypto');
const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { expandBookingDays } = require('../lib/expectedVisits');

// GET /api/visitors — list visitors
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { site_id, status, from, to, search, limit } = req.query;
    let query = supabase
      .from('visitors')
      .select('*, officer:users(first_name, last_name), site:sites(name)')
      .eq('company_id', req.user.company_id)
      .order('time_in', { ascending: false });

    if (site_id) query = query.eq('site_id', site_id);
    if (status)  query = query.eq('status', status);
    if (from)    query = query.gte('time_in', from);
    if (to)      query = query.lte('time_in', to);
    if (search)  query = query.or(`visitor_name.ilike.%${search}%,company_name.ilike.%${search}%,vehicle_reg.ilike.%${search}%`);
    if (limit)   query = query.limit(parseInt(limit));
    else         query = query.limit(100);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/visitors — sign in a visitor
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { site_id, visitor_name, company_name, who_visiting, pass_number, vehicle_reg, personnel_count, visit_type, notes } = req.body;
    if (!site_id || !visitor_name) return res.status(400).json({ error: 'Site and visitor name are required' });
    const { data, error } = await supabase
      .from('visitors')
      .insert({
        company_id: req.user.company_id,
        site_id,
        shift_id: req.body.shift_id || null,
        officer_id: req.user.id,
        visitor_name,
        company_name: company_name || null,
        who_visiting: who_visiting || null,
        pass_number: pass_number || null,
        vehicle_reg: vehicle_reg || null,
        personnel_count: parseInt(personnel_count) || 1,
        visit_type: visit_type || 'visitor',
        notes: notes || null,
        status: 'on_site',
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PATCH /api/visitors/:id — update visitor (sign out, add notes)
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const allowed = ['time_out', 'status', 'notes', 'pass_number', 'vehicle_reg'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase
      .from('visitors')
      .update(updates)
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .select()
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// DELETE /api/visitors/:id
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('visitors')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/visitors/expire — auto sign-out visitors still on site at midnight
router.post('/expire', async (req, res) => {
  try {
    const now = new Date();
    const { data, error } = await supabase
      .from('visitors')
      .update({ status: 'signed_out', time_out: now.toISOString(), notes: 'Auto signed out at midnight' })
      .eq('status', 'on_site')
      .select('id, visitor_name, site_id');
    if (error) throw error;
    console.log(`[Visitors] Auto-expired ${(data || []).length} visitors at midnight`);
    res.json({ expired: (data || []).length, visitors: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/visitors/expected — ops creates expected visit(s)
router.post('/expected', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { site_id, visitor_name, company_name, who_visiting, expected_from, expected_to, expected_time, personnel_count, vehicle_reg, notes, visit_type } = req.body;
    if (!site_id || !visitor_name || !expected_from || !expected_to) return res.status(400).json({ error: 'site_id, visitor_name, expected_from and expected_to are required' });

    const result = expandBookingDays(expected_from, expected_to);
    if (result.error) return res.status(400).json({ error: result.error, message: result.message });

    const booking_group_id = crypto.randomUUID();
    const rows = result.days.map(day => ({
      company_id: req.user.company_id,
      site_id,
      visitor_name,
      company_name: company_name || null,
      who_visiting: who_visiting || null,
      vehicle_reg: vehicle_reg || null,
      personnel_count: parseInt(personnel_count) || 1,
      visit_type: visit_type || 'contractor',
      notes: notes || null,
      expected_date: day,
      expected_time: expected_time || null,
      booking_group_id,
      status: 'expected',
      time_in: null,
      created_by_source: 'ops',
      created_by: req.user.id,
    }));

    const { data, error } = await supabase.from('visitors').insert(rows).select();
    if (error) throw error;
    res.status(201).json({ data: { booking_group_id, days: result.days.length, rows: data } });
  } catch (err) { next(err); }
});

// GET /api/visitors/expected — list expected visitors
router.get('/expected', authenticate, async (req, res, next) => {
  try {
    const { site_id, date, booking_group_id, from, to, upcoming } = req.query;
    let query = supabase
      .from('visitors')
      .select('*, site:sites(name)')
      .eq('company_id', req.user.company_id)
      .eq('status', 'expected');

    let isRange = false;
    if (booking_group_id) {
      query = query.eq('booking_group_id', booking_group_id);
    } else if (from || to || upcoming === 'true') {
      isRange = true;
      const rangeFrom = from || (upcoming === 'true' ? new Date().toISOString().slice(0, 10) : null);
      if (rangeFrom) query = query.gte('expected_date', rangeFrom);
      if (to) query = query.lte('expected_date', to);
      if (site_id) query = query.eq('site_id', site_id);
    } else {
      const targetDate = date || new Date().toISOString().slice(0, 10);
      query = query.eq('expected_date', targetDate);
      if (site_id) query = query.eq('site_id', site_id);
    }

    if (isRange) {
      query = query.order('expected_date', { ascending: true }).order('expected_time', { ascending: true, nullsFirst: false }).order('visitor_name', { ascending: true });
    } else {
      query = query.order('expected_time', { ascending: true, nullsFirst: false }).order('visitor_name', { ascending: true });
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/visitors/:id/arrive — officer marks expected visitor as arrived
router.post('/:id/arrive', authenticate, async (req, res, next) => {
  try {
    const { arrival_photo_url, notes } = req.body;
    const updates = {
      status: 'on_site',
      time_in: new Date().toISOString(),
      officer_id: req.user.id,
    };
    if (arrival_photo_url) updates.arrival_photo_url = arrival_photo_url;
    if (notes) updates.notes = notes;

    const { data, error } = await supabase
      .from('visitors')
      .update(updates)
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .eq('status', 'expected')
      .select('*, site:sites(id,name)')
      .single();
    if (error || !data) return res.status(404).json({ error: 'Expected visit not found or already arrived' });

    // Create arrival log
    try {
      await supabase.from('occurrence_logs').insert({
        company_id: req.user.company_id,
        site_id: data.site_id,
        shift_id: data.shift_id || null,
        officer_id: req.user.id,
        log_type: 'VISITOR',
        title: `VISITOR — ${data.visitor_name}`,
        description: `${data.visitor_name}${data.who_visiting ? ' visiting ' + data.who_visiting : ''}.${data.personnel_count > 1 ? ' ' + data.personnel_count + ' person(s).' : ''}${data.vehicle_reg ? ' Vehicle: ' + data.vehicle_reg : ''}`,
        occurred_at: new Date().toISOString(),
        type_data: { visitor_name: data.visitor_name, visitor_who_visiting: data.who_visiting, visitor_vehicle_reg: data.vehicle_reg, visitor_personnel_count: data.personnel_count, expected_visit: true },
      });
    } catch {}

    res.json({ data });
  } catch (err) { next(err); }
});

// PATCH /api/visitors/booking/:groupId — edit future expected visits in a group
router.patch('/booking/:groupId', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const allowed = ['visitor_name', 'company_name', 'who_visiting', 'expected_time', 'personnel_count', 'vehicle_reg', 'notes'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const { data, error } = await supabase
      .from('visitors')
      .update(updates)
      .eq('booking_group_id', req.params.groupId)
      .eq('company_id', req.user.company_id)
      .eq('status', 'expected')
      .select('id');
    if (error) throw error;
    res.json({ data: { updated: (data || []).length } });
  } catch (err) { next(err); }
});

// DELETE /api/visitors/booking/:groupId — soft cancel future expected visits
router.delete('/booking/:groupId', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('visitors')
      .update({ status: 'cancelled' })
      .eq('booking_group_id', req.params.groupId)
      .eq('company_id', req.user.company_id)
      .eq('status', 'expected')
      .gte('expected_date', new Date().toISOString().slice(0, 10))
      .select('id');
    if (error) throw error;
    res.json({ data: { cancelled: (data || []).length } });
  } catch (err) { next(err); }
});

module.exports = router;
