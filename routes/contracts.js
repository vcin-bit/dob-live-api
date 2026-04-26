const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// ── CONTRACT LINES ─────────────────────────────────────────────────────────
router.get('/lines', authenticate, async (req, res, next) => {
  try {
    const { site_id } = req.query;
    let q = supabase.from('contract_lines')
      .select('*, site:sites(id,name)')
      .eq('company_id', req.user.company_id)
      .order('created_at', { ascending: false });
    if (site_id) q = q.eq('site_id', site_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/lines', authenticate, requireRole('SUPER_ADMIN','COMPANY','OPS_MANAGER','FD'), async (req, res, next) => {
  try {
    const { site_id, name, category, description, cost, charge, recurring, start_date, end_date, notes } = req.body;
    const { data, error } = await supabase.from('contract_lines')
      .insert({ company_id: req.user.company_id, site_id, name, category, description, cost, charge, recurring, start_date, end_date, notes })
      .select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.patch('/lines/:id', authenticate, requireRole('SUPER_ADMIN','COMPANY','OPS_MANAGER','FD'), async (req, res, next) => {
  try {
    const allowed = ['name','category','description','cost','charge','recurring','start_date','end_date','notes','active'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase.from('contract_lines').update(updates).eq('id', req.params.id).eq('company_id', req.user.company_id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/lines/:id', authenticate, requireRole('SUPER_ADMIN','COMPANY','FD'), async (req, res, next) => {
  try {
    await supabase.from('contract_lines').delete().eq('id', req.params.id).eq('company_id', req.user.company_id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── CONTRACT QUERIES ────────────────────────────────────────────────────────
router.get('/queries', authenticate, async (req, res, next) => {
  try {
    const { status, site_id } = req.query;
    let q = supabase.from('contract_queries')
      .select('*, site:sites(id,name), raiser:users!contract_queries_raised_by_fkey(id,first_name,last_name)')
      .eq('company_id', req.user.company_id)
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    if (site_id) q = q.eq('site_id', site_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/queries', authenticate, async (req, res, next) => {
  try {
    const { site_id, category, subject, description, priority } = req.body;
    const { data, error } = await supabase.from('contract_queries')
      .insert({ company_id: req.user.company_id, site_id, raised_by: req.user.id, category, subject, description, priority: priority||'medium' })
      .select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.post('/queries/:id/respond', authenticate, async (req, res, next) => {
  try {
    const { text, status } = req.body;
    const { data: query } = await supabase.from('contract_queries').select('responses').eq('id', req.params.id).single();
    const responses = [...(query?.responses || []), {
      from: 'manager',
      name: `${req.user.first_name} ${req.user.last_name}`,
      text,
      created_at: new Date().toISOString(),
    }];
    const updates = { responses };
    if (status) { updates.status = status; if (status === 'resolved') updates.resolved_at = new Date().toISOString(); }
    const { data, error } = await supabase.from('contract_queries').update(updates).eq('id', req.params.id).eq('company_id', req.user.company_id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
