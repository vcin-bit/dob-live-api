const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/tenants — list tenants
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { site_id, search } = req.query;
    let query = supabase
      .from('site_tenants')
      .select('*, contacts:tenant_contacts(*)')
      .eq('company_id', req.user.company_id)
      .order('unit_ref', { ascending: true, nullsFirst: false })
      .order('tenant_name', { ascending: true });

    if (site_id) query = query.eq('site_id', site_id);
    if (search) query = query.or(`unit_ref.ilike.%${search}%,tenant_name.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/tenants/:id — single tenant with contacts
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('site_tenants')
      .select('*, contacts:tenant_contacts(*)')
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/tenants — create tenant
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { site_id, unit_ref, tenant_name, comments, status } = req.body;
    if (!site_id || !tenant_name) return res.status(400).json({ error: 'site_id and tenant_name are required' });
    const { data, error } = await supabase
      .from('site_tenants')
      .insert({
        company_id: req.user.company_id,
        site_id,
        unit_ref: unit_ref || null,
        tenant_name,
        comments: comments || null,
        status: status || 'active',
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PATCH /api/tenants/:id — update tenant
router.patch('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const allowed = ['unit_ref', 'tenant_name', 'comments', 'status'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase
      .from('site_tenants')
      .update(updates)
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .select()
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// DELETE /api/tenants/:id — delete tenant (cascade removes contacts)
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('site_tenants')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/tenants/:id/contacts — add contact to tenant
router.post('/:id/contacts', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { data: tenant, error: tErr } = await supabase
      .from('site_tenants')
      .select('id')
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .single();
    if (tErr || !tenant) return res.status(404).json({ error: 'Tenant not found' });

    const { position, name, phone, email, label, notes } = req.body;
    const { data, error } = await supabase
      .from('tenant_contacts')
      .insert({
        tenant_id: req.params.id,
        position: parseInt(position) || 1,
        name: name || null,
        phone: phone || null,
        email: email || null,
        label: label || null,
        notes: notes || null,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PATCH /api/tenants/contacts/:contactId — update contact
router.patch('/contacts/:contactId', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { data: contact, error: cErr } = await supabase
      .from('tenant_contacts')
      .select('id, tenant:site_tenants!tenant_contacts_tenant_id_fkey(company_id)')
      .eq('id', req.params.contactId)
      .single();
    if (cErr || !contact || contact.tenant?.company_id !== req.user.company_id) return res.status(404).json({ error: 'Contact not found' });

    const allowed = ['position', 'name', 'phone', 'email', 'label', 'notes'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase
      .from('tenant_contacts')
      .update(updates)
      .eq('id', req.params.contactId)
      .select()
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// DELETE /api/tenants/contacts/:contactId — delete contact
router.delete('/contacts/:contactId', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { data: contact, error: cErr } = await supabase
      .from('tenant_contacts')
      .select('id, tenant:site_tenants!tenant_contacts_tenant_id_fkey(company_id)')
      .eq('id', req.params.contactId)
      .single();
    if (cErr || !contact || contact.tenant?.company_id !== req.user.company_id) return res.status(404).json({ error: 'Contact not found' });

    const { error } = await supabase
      .from('tenant_contacts')
      .delete()
      .eq('id', req.params.contactId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
