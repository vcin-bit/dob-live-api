const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/users/me — current user profile
router.get('/me', authenticate, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ data: req.user });
  } catch (err) { next(err); }
});

// GET /api/users — all users in company (managers+)
router.get('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, clerk_id, role, first_name, last_name, email, phone, sia_licence_number, sia_expiry_date, active, created_at')
      .eq('company_id', req.user.company_id)
      .order('last_name');
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/users/:id
router.get('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'User not found' });
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/users — create officer/manager (company admin only)
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY'), async (req, res, next) => {
  try {
    const { clerk_id, role, first_name, last_name, email, phone, sia_licence_number, sia_expiry_date } = req.body;
    const { data, error } = await supabase
      .from('users')
      .insert({
        clerk_id,
        company_id: req.user.company_id,
        role: role || 'OFFICER',
        first_name,
        last_name,
        email,
        phone,
        sia_licence_number,
        sia_expiry_date
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PATCH /api/users/:id
router.patch('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const allowed = ['first_name', 'last_name', 'phone', 'sia_licence_number', 'sia_expiry_date', 'active', 'role'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .select()
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;

// GET /api/users/:id/sites — sites assigned to an officer
router.get('/:id/sites', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('officer_sites')
      .select('site:sites(id, name, address)')
      .eq('officer_id', req.params.id);
    if (error) throw error;
    res.json({ data: data.map(r => r.site) });
  } catch (err) { next(err); }
});

// PUT /api/users/:id/sites — replace all site assignments for an officer
router.put('/:id/sites', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const { site_ids } = req.body;
    // Delete existing
    await supabase.from('officer_sites').delete().eq('officer_id', req.params.id);
    // Insert new
    if (site_ids && site_ids.length > 0) {
      const rows = site_ids.map(site_id => ({ officer_id: req.params.id, site_id }));
      const { error } = await supabase.from('officer_sites').insert(rows);
      if (error) throw error;
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
