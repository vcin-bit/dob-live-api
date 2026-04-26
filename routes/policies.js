const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('company_policies')
      .select('*')
      .eq('company_id', req.user.company_id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data: data || { sections: [] } });
  } catch (err) { next(err); }
});

router.put('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'FD'), async (req, res, next) => {
  try {
    const { sections } = req.body;
    const { data, error } = await supabase
      .from('company_policies')
      .upsert({ company_id: req.user.company_id, sections, updated_by: req.user.id, updated_at: new Date().toISOString() }, { onConflict: 'company_id' })
      .select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
