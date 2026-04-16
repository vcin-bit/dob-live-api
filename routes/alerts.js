const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, site_id } = req.query;
    let q = supabase.from('client_alerts').select('*, site:sites(id,name), creator:users!client_alerts_created_by_fkey(id,first_name,last_name)').eq('company_id', req.user.company_id).order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    if (site_id) q = q.eq('site_id', site_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { site_id, title, description, severity } = req.body;
    const { data, error } = await supabase.from('client_alerts').insert({ company_id: req.user.company_id, site_id, title, description, severity: severity || 'medium', created_by: req.user.id }).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.status === 'resolved') { updates.status = 'resolved'; updates.resolved_by = req.user.id; updates.resolved_at = new Date().toISOString(); }
    else if (req.body.status) updates.status = req.body.status;
    if (req.body.title) updates.title = req.body.title;
    if (req.body.description) updates.description = req.body.description;
    const { data, error } = await supabase.from('client_alerts').update(updates).eq('id', req.params.id).eq('company_id', req.user.company_id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
