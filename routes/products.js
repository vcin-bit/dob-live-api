const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { site_id } = req.query;
    let query = supabase
      .from('site_products')
      .select('*, site:sites(id, name)')
      .eq('company_id', req.user.company_id)
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (site_id) query = query.eq('site_id', site_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'FD'), async (req, res, next) => {
  try {
    const { site_id, name, cost, charge, frequency } = req.body;
    if (!site_id || !name) return res.status(400).json({ error: 'site_id and name are required' });
    const { data, error } = await supabase.from('site_products').insert({
      company_id: req.user.company_id, site_id, name,
      cost: cost || 0, charge: charge || 0,
      frequency: frequency || 'monthly',
    }).select('*, site:sites(id, name)').single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'FD'), async (req, res, next) => {
  try {
    const allowed = ['name', 'cost', 'charge', 'frequency', 'site_id'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase.from('site_products').update(updates)
      .eq('id', req.params.id).eq('company_id', req.user.company_id)
      .select('*, site:sites(id, name)').single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'FD'), async (req, res, next) => {
  try {
    const { error } = await supabase.from('site_products').update({ active: false })
      .eq('id', req.params.id).eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
