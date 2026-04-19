const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

const ALL_FIELDS = ['name','address','city','postcode','active','client_id',
  'contact_name','contact_phone','contact_email',
  'escalation_contact_1_name','escalation_contact_1_mobile',
  'escalation_contact_2_name','escalation_contact_2_mobile',
  'geofence_lat','geofence_lng','geofence_radius','notes',
  'client_portal_enabled','client_portal_pin','client_name',
  'client_contact_name','client_contact_email','client_contact_phone',
  'contract_start_date','client_company_address'];

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

router.post('/', authenticate, requireRole('SUPER_ADMIN','COMPANY','OPS_MANAGER'), async (req, res, next) => {
  try {
    const payload = Object.fromEntries(Object.entries(req.body).filter(([k]) => ALL_FIELDS.includes(k)));
    if (!payload.name) return res.status(400).json({ error: 'Site name is required' });
    payload.company_id = req.user.company_id;
    if (payload.geofence_lat) payload.geofence_lat = parseFloat(payload.geofence_lat);
    if (payload.geofence_lng) payload.geofence_lng = parseFloat(payload.geofence_lng);
    const { data, error } = await supabase.from('sites').insert(payload).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, requireRole('SUPER_ADMIN','COMPANY','OPS_MANAGER'), async (req, res, next) => {
  try {
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => ALL_FIELDS.includes(k)));
    if (updates.geofence_lat) updates.geofence_lat = parseFloat(updates.geofence_lat);
    if (updates.geofence_lng) updates.geofence_lng = parseFloat(updates.geofence_lng);
    const { data, error } = await supabase.from('sites').update(updates).eq('id', req.params.id).eq('company_id', req.user.company_id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, requireRole('SUPER_ADMIN','COMPANY'), async (req, res, next) => {
  try {
    const { error } = await supabase.from('sites').delete().eq('id', req.params.id).eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Site Codes CRUD ─────────────────────────────────────────
router.get('/:id/codes', authenticate, requireRole('SUPER_ADMIN','COMPANY','OPS_MANAGER','FD'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('site_codes')
      .select('*')
      .eq('site_id', req.params.id)
      .eq('company_id', req.user.company_id)
      .order('label');
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/:id/codes', authenticate, requireRole('SUPER_ADMIN','COMPANY','OPS_MANAGER'), async (req, res, next) => {
  try {
    const { label, code, code_type, notes } = req.body;
    if (!label || !code) return res.status(400).json({ error: 'Label and code are required' });
    const { data, error } = await supabase
      .from('site_codes')
      .insert({ site_id: req.params.id, company_id: req.user.company_id, label, code, code_type: code_type || 'keypad', notes })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.patch('/:id/codes/:codeId', authenticate, requireRole('SUPER_ADMIN','COMPANY','OPS_MANAGER'), async (req, res, next) => {
  try {
    const allowed = ['label', 'code', 'code_type', 'notes'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('site_codes')
      .update(updates)
      .eq('id', req.params.codeId)
      .eq('site_id', req.params.id)
      .eq('company_id', req.user.company_id)
      .select()
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id/codes/:codeId', authenticate, requireRole('SUPER_ADMIN','COMPANY','OPS_MANAGER'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('site_codes')
      .delete()
      .eq('id', req.params.codeId)
      .eq('site_id', req.params.id)
      .eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
