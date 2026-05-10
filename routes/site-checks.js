const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/site-checks/:siteId — get checks configured for a site
router.get('/:siteId', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('site_checks')
      .select('*')
      .eq('site_id', req.params.siteId)
      .eq('company_id', req.user.company_id)
      .eq('active', true)
      .order('sort_order');
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/site-checks/:siteId — add a check (ops only)
router.post('/:siteId', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { label, sort_order } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'Label required' });
    const { data, error } = await supabase
      .from('site_checks')
      .insert({ site_id: req.params.siteId, company_id: req.user.company_id, label: label.trim(), sort_order: sort_order || 0 })
      .select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// DELETE /api/site-checks/:siteId/:id — remove a check
router.delete('/:siteId/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    await supabase.from('site_checks').update({ active: false }).eq('id', req.params.id).eq('company_id', req.user.company_id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/site-checks/complete — officer completes checks on shift start
router.post('/complete/:shiftId', authenticate, async (req, res, next) => {
  try {
    const { checks } = req.body; // [{ check_id, notes }]
    if (!checks?.length) return res.status(400).json({ error: 'No checks provided' });
    const records = checks.map(c => ({
      shift_id: req.params.shiftId,
      check_id: c.check_id,
      officer_id: req.user.id,
      notes: c.notes || null,
    }));
    const { data, error } = await supabase.from('shift_checks').insert(records).select();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// GET /api/site-checks/completed/:shiftId — get completed checks for a shift
router.get('/completed/:shiftId', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('shift_checks')
      .select('*, check:site_checks(label), officer:users(first_name, last_name)')
      .eq('shift_id', req.params.shiftId);
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
