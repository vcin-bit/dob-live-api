const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { site_id, shift_id } = req.query;
    let query = supabase
      .from('handover_briefs')
      .select(`*, author:users!handover_briefs_authored_by_fkey(id, first_name, last_name), handed_to_user:users!handover_briefs_handed_to_fkey(id, first_name, last_name), site:sites(id, name)`)
      .eq('company_id', req.user.company_id)
      .order('created_at', { ascending: false });
    if (site_id)  query = query.eq('site_id', site_id);
    if (shift_id) query = query.eq('shift_id', shift_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { site_id, shift_id, handed_to, content } = req.body;
    const { data, error } = await supabase
      .from('handover_briefs')
      .insert({ company_id: req.user.company_id, authored_by: req.user.id, site_id, shift_id, handed_to, content })
      .select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
