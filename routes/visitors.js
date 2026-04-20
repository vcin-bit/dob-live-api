const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

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
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
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

module.exports = router;
