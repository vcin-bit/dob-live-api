const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('companies').select('*').eq('id', req.user.company_id).single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.patch('/me', authenticate, requireRole('SUPER_ADMIN', 'COMPANY'), async (req, res, next) => {
  try {
    const allowed = ['name', 'email', 'phone', 'address', 'logo_url'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase
      .from('companies').update(updates).eq('id', req.user.company_id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
