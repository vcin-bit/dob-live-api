const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/instructions?site_id=xxx
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { site_id } = req.query;
    if (!site_id) return res.status(400).json({ error: 'site_id required' });
    const { data, error } = await supabase
      .from('site_instructions')
      .select('*')
      .eq('site_id', site_id)
      .eq('company_id', req.user.company_id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data: data || { site_id, sections: [] } });
  } catch (err) { next(err); }
});

// PUT /api/instructions?site_id=xxx
router.put('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { site_id } = req.query;
    const { sections } = req.body;
    if (!site_id) return res.status(400).json({ error: 'site_id required' });
    const { data, error } = await supabase
      .from('site_instructions')
      .upsert({ company_id: req.user.company_id, site_id, sections, updated_by: req.user.id, updated_at: new Date().toISOString() }, { onConflict: 'site_id' })
      .select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
