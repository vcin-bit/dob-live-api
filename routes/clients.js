const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('clients').select('*').eq('company_id', req.user.company_id).order('client_company_name');
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'FD'), async (req, res, next) => {
  try {
    const { contact_name, contact_email, contact_phone, client_company_name } = req.body;
    const { data, error } = await supabase
      .from('clients')
      .insert({ company_id: req.user.company_id, contact_name, contact_email, contact_phone, client_company_name })
      .select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'FD'), async (req, res, next) => {
  try {
    const allowed = ['contact_name', 'contact_email', 'contact_phone', 'client_company_name', 'active'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase.from('clients').update(updates).eq('id', req.params.id).eq('company_id', req.user.company_id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
