const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/distribution — list recipients
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { site_id, search } = req.query;
    let query = supabase
      .from('distribution_recipients')
      .select('*')
      .eq('company_id', req.user.company_id)
      .order('name', { ascending: true, nullsFirst: false })
      .order('email', { ascending: true });

    if (site_id) query = query.eq('site_id', site_id);
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,unit_ref.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/distribution — add recipient
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { site_id, email, name, unit_ref, active } = req.body;
    if (!site_id || !email) return res.status(400).json({ error: 'site_id and email are required' });
    const { data, error } = await supabase
      .from('distribution_recipients')
      .insert({
        company_id: req.user.company_id,
        site_id,
        email,
        name: name || null,
        unit_ref: unit_ref || null,
        active: active !== undefined ? active : true,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PATCH /api/distribution/:id — update recipient
router.patch('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const allowed = ['name', 'email', 'unit_ref', 'active'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase
      .from('distribution_recipients')
      .update(updates)
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .select()
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// DELETE /api/distribution/:id — remove recipient
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('distribution_recipients')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
