// routes/sites.js
const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('sites')
      .select('*, client:clients(id, client_company_name)')
      .eq('company_id', req.user.company_id)
      .order('name');
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('sites').select('*').eq('id', req.params.id).eq('company_id', req.user.company_id).single();
    if (error || !data) return res.status(404).json({ error: 'Site not found' });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const { name, address, client_id, geofence_lat, geofence_lng, geofence_radius_metres } = req.body;
    const { data, error } = await supabase
      .from('sites').insert({ company_id: req.user.company_id, name, address, client_id, geofence_lat, geofence_lng, geofence_radius_metres }).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const allowed = ['name', 'address', 'client_id', 'geofence_lat', 'geofence_lng', 'geofence_radius_metres', 'active'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase.from('sites').update(updates).eq('id', req.params.id).eq('company_id', req.user.company_id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;

router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('sites')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
