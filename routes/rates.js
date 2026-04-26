const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { officer_id, site_id } = req.query;
    let query = supabase
      .from('officer_rates')
      .select('*, officer:users(id, first_name, last_name), site:sites(id, name)')
      .eq('company_id', req.user.company_id)
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (officer_id) query = query.eq('officer_id', officer_id);
    if (site_id) query = query.eq('site_id', site_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { officer_id, site_id, hourly_rate, role_label, notes } = req.body;
    const { data, error } = await supabase.from('officer_rates').insert({ company_id: req.user.company_id, officer_id, site_id, hourly_rate, role_label, notes }).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const allowed = ['hourly_rate', 'site_id', 'role_label', 'notes'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase.from('officer_rates').update(updates).eq('id', req.params.id).eq('company_id', req.user.company_id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { error } = await supabase.from('officer_rates').update({ active: false }).eq('id', req.params.id).eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
