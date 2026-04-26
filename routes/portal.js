/**
 * Client Portal routes — separate auth from Clerk, PIN-based per site
 */
const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || process.env.CLERK_SECRET_KEY;

// ── Portal auth middleware ─────────────────────────────────────────────────
function portalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorised' });
  try {
    req.portalSession = jwt.verify(auth.slice(7), JWT_SECRET);
    if (req.portalSession.type !== 'portal') throw new Error('Wrong token type');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── POST /api/portal/auth — PIN login ──────────────────────────────────────
router.post('/auth', async (req, res, next) => {
  try {
    const { site_id, pin } = req.body;
    if (!site_id || !pin) return res.status(400).json({ error: 'site_id and pin required' });

    const { data: site, error } = await supabase
      .from('sites')
      .select('id, name, client_name, client_portal_enabled, client_portal_pin, company_id')
      .eq('id', site_id)
      .single();

    if (error || !site) return res.status(404).json({ error: 'Site not found' });
    if (!site.client_portal_enabled) return res.status(403).json({ error: 'Client portal not enabled for this site' });
    if (!site.client_portal_pin) return res.status(403).json({ error: 'No PIN set for this site' });
    if (String(site.client_portal_pin) !== String(pin)) return res.status(401).json({ error: 'Incorrect PIN' });

    const token = jwt.sign(
      { type: 'portal', site_id: site.id, company_id: site.company_id, site_name: site.name },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ token, site: { id: site.id, name: site.name, client_name: site.client_name } });
  } catch (err) { next(err); }
});

// ── GET /api/portal/summary ────────────────────────────────────────────────
router.get('/summary', portalAuth, async (req, res, next) => {
  try {
    const { site_id, company_id } = req.portalSession;
    const from = new Date(); from.setDate(from.getDate() - 7);

    const [logsRes, alertsRes, tasksRes] = await Promise.all([
      supabase.from('occurrence_logs').select('id, log_type, occurred_at').eq('site_id', site_id).gte('occurred_at', from.toISOString()),
      supabase.from('client_alerts').select('id, status').eq('site_id', site_id).eq('status', 'open'),
      supabase.from('tasks').select('id, status').eq('site_id', site_id).neq('status', 'COMPLETE'),
    ]);

    const logs = logsRes.data || [];
    res.json({
      data: {
        logs_7d:      logs.length,
        incidents_7d: logs.filter(l => l.log_type === 'INCIDENT').length,
        patrols_7d:   logs.filter(l => l.log_type === 'PATROL').length,
        open_alerts:  (alertsRes.data || []).length,
        open_tasks:   (tasksRes.data || []).length,
      }
    });
  } catch (err) { next(err); }
});

// ── GET /api/portal/logs ───────────────────────────────────────────────────
router.get('/logs', portalAuth, async (req, res, next) => {
  try {
    const { site_id } = req.portalSession;
    const { limit = 50, offset = 0, log_type } = req.query;
    let q = supabase.from('occurrence_logs')
      .select('id, log_type, title, description, occurred_at, officer:users(first_name, last_name)')
      .eq('site_id', site_id)
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (log_type) q = q.eq('log_type', log_type);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// ── GET /api/portal/alerts ─────────────────────────────────────────────────
router.get('/alerts', portalAuth, async (req, res, next) => {
  try {
    const { site_id } = req.portalSession;
    const { status } = req.query;
    let q = supabase.from('client_alerts')
      .select('*')
      .eq('site_id', site_id)
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// ── POST /api/portal/alerts — client raises alert ─────────────────────────
router.post('/alerts', portalAuth, async (req, res, next) => {
  try {
    const { site_id, company_id } = req.portalSession;
    const { title, description } = req.body;
    const { data, error } = await supabase.from('client_alerts')
      .insert({ company_id, site_id, title, description, severity: 'medium' })
      .select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// ── GET /api/portal/documents ──────────────────────────────────────────────
router.get('/documents', portalAuth, async (req, res, next) => {
  try {
    const { site_id } = req.portalSession;
    const [foldersRes, docsRes] = await Promise.all([
      supabase.from('site_folders').select('*').eq('site_id', site_id).order('name'),
      supabase.from('site_documents').select('*').eq('site_id', site_id).order('created_at', { ascending: false }),
    ]);
    res.json({ folders: foldersRes.data || [], documents: docsRes.data || [] });
  } catch (err) { next(err); }
});

// ── Manager: enable portal + set PIN ──────────────────────────────────────
router.put('/settings/:site_id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { client_portal_enabled, client_portal_pin, client_name, client_contact_name, client_contact_email, client_contact_phone } = req.body;
    const { data, error } = await supabase.from('sites')
      .update({ client_portal_enabled, client_portal_pin, client_name, client_contact_name, client_contact_email, client_contact_phone })
      .eq('id', req.params.site_id)
      .eq('company_id', req.user.company_id)
      .select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// ── GET /api/portal/site-list — public list of portal-enabled sites ────────
router.get('/sites', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('sites')
      .select('id, name, client_name')
      .eq('client_portal_enabled', true)
      .order('name');
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
