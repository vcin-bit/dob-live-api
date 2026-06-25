/**
 * Client Portal routes — separate auth from Clerk, PIN-based per site
 */
const crypto  = require('crypto');
const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { expandBookingDays } = require('../lib/expectedVisits');

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
    const from7d = new Date(); from7d.setDate(from7d.getDate() - 7);
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);

    const [logsRes, alertsRes, activeShiftRes, patrolsRes, siteRes] = await Promise.all([
      supabase.from('occurrence_logs').select('id, log_type, occurred_at, client_reportable, type_data').eq('site_id', site_id).gte('occurred_at', from7d.toISOString()),
      supabase.from('client_alerts').select('id, status').eq('site_id', site_id).eq('status', 'open'),
      supabase.from('shifts').select('id, checked_in_at, officer:users!shifts_officer_id_fkey(first_name, last_name, sia_licence_number, sia_licence_type)').eq('site_id', site_id).eq('status', 'ACTIVE'),
      supabase.from('patrol_sessions').select('id, started_at, ended_at, checkpoints_completed').eq('site_id', site_id).gte('started_at', from7d.toISOString()).eq('status', 'completed'),
      supabase.from('sites').select('contracted_hours_weekly').eq('id', site_id).single(),
    ]);

    const logs = logsRes.data || [];
    const activeShifts = activeShiftRes.data || [];
    const patrols = patrolsRes.data || [];
    const contractedWeekly = parseFloat(siteRes.data?.contracted_hours_weekly) || 0;

    // Hours delivered this week — only COMPLETED/ACTIVE, use actual times where available
    const weekShiftsRes = await supabase.from('shifts').select('start_time, end_time, checked_in_at, checked_out_at, status')
      .eq('site_id', site_id).gte('start_time', from7d.toISOString()).in('status', ['COMPLETED', 'ACTIVE']);
    const weekShifts = weekShiftsRes.data || [];
    const hoursDelivered = weekShifts.reduce((t, s) => {
      const start = s.checked_in_at || s.start_time;
      const end = s.checked_out_at || s.end_time;
      return t + (end ? Math.max(0, (new Date(end) - new Date(start)) / 3600000) : 0);
    }, 0);

    // On duty officer info
    const onDuty = activeShifts.length > 0 ? activeShifts.map(s => ({
      name: s.officer ? `${s.officer.first_name} ${s.officer.last_name}` : 'Unknown',
      sia_type: s.officer?.sia_licence_type || null,
      sia_last4: s.officer?.sia_licence_number ? `••••${s.officer.sia_licence_number.slice(-4)}` : null,
      since: s.checked_in_at,
    })) : [];

    // Occurrence counts by type (client-relevant only)
    const incidents = logs.filter(l => l.log_type === 'INCIDENT').length;
    const vehicleReports = logs.filter(l => l.log_type === 'VEHICLE_CHECK').length;
    const healthSafety = logs.filter(l => l.log_type === 'HEALTH_SAFETY').length;
    const alarms = logs.filter(l => ['ALARM','FIRE_ALARM','EMERGENCY'].includes(l.log_type)).length;
    const cctvPatrols = logs.filter(l => l.log_type === 'CCTV_CHECK').length;
    const policeInvolved = logs.filter(l => l.type_data?.police_reported === true).length;
    const totalOccurrences = incidents + vehicleReports + healthSafety + alarms;
    const footPatrols = patrols.length;

    res.json({
      data: {
        logs_7d: logs.length,
        incidents_7d: incidents,
        vehicle_reports_7d: vehicleReports,
        health_safety_7d: healthSafety,
        alarms_7d: alarms,
        police_involved_7d: policeInvolved,
        cctv_patrols_7d: cctvPatrols,
        foot_patrols_7d: footPatrols,
        total_occurrences_7d: totalOccurrences,
        patrols_7d: footPatrols,
        patrols_today: patrols.filter(p => new Date(p.started_at) >= todayStart).length,
        open_alerts: (alertsRes.data || []).length,
        on_duty: onDuty,
        hours_delivered_7d: Math.round(hoursDelivered * 10) / 10,
        contracted_weekly: contractedWeekly,
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
      .select('id, log_type, title, description, occurred_at, client_reportable, review_status, officer:users!occurrence_logs_officer_id_fkey(first_name, last_name)')
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

// ── PATCH /api/portal/alerts/:id — client edits task ──────────────────────
router.patch('/alerts/:id', portalAuth, async (req, res, next) => {
  try {
    const { site_id } = req.portalSession;
    const { title, description, status } = req.body;
    const updates = {};
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status) updates.status = status;
    const { data, error } = await supabase.from('client_alerts').update(updates).eq('id', req.params.id).eq('site_id', site_id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// ── DELETE /api/portal/alerts/:id — client deletes task ───────────────────
router.delete('/alerts/:id', portalAuth, async (req, res, next) => {
  try {
    const { site_id } = req.portalSession;
    const { error } = await supabase.from('client_alerts').delete().eq('id', req.params.id).eq('site_id', site_id);
    if (error) throw error;
    res.json({ success: true });
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

// GET /api/portal/controlled-documents — Approved Client-audience docs
router.get('/controlled-documents', portalAuth, async (req, res, next) => {
  try {
    const { company_id } = req.portalSession;
    const { data, error } = await supabase
      .from('controlled_documents')
      .select('id, doc_number, revision, title, category, issue_date, file_name')
      .eq('company_id', company_id)
      .eq('is_current', true)
      .eq('status', 'Approved')
      .eq('audience', 'Client')
      .order('doc_number');
    if (error) throw error;
    res.json({ data });
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

// ── GET /api/portal/risk-assessments — read-only RAs for this site ─────────
router.get('/risk-assessments', portalAuth, async (req, res, next) => {
  try {
    const { site_id, company_id } = req.portalSession;
    const { data: ras, error } = await supabase
      .from('risk_assessments')
      .select('id, reference_number, title, assessment_type, scope, description, methodology, assessment_date, review_date, status, overall_risk_level, residual_risk_level, approved_date')
      .eq('company_id', company_id)
      .eq('site_id', site_id)
      .order('assessment_date', { ascending: false });
    if (error) throw error;

    // Attach risks for each RA
    const raIds = (ras || []).map(r => r.id);
    let risks = [];
    if (raIds.length > 0) {
      const { data: riskData } = await supabase
        .from('risks')
        .select('id, risk_assessment_id, hazard_description, who_at_risk, potential_consequences, existing_controls, likelihood_score, severity_score, risk_level, additional_controls, residual_likelihood, residual_severity, residual_level, risk_category:risk_categories(name)')
        .in('risk_assessment_id', raIds)
        .order('created_at');
      risks = riskData || [];
    }

    const result = (ras || []).map(ra => ({
      ...ra,
      risks: risks.filter(r => r.risk_assessment_id === ra.id),
    }));

    res.json({ data: result });
  } catch (err) { next(err); }
});

// ── GET /api/portal/assignment-instructions — published AI + client approval ──
router.get('/assignment-instructions', portalAuth, async (req, res, next) => {
  try {
    const { site_id, company_id } = req.portalSession;
    const { data: ai } = await supabase
      .from('site_assignment_instructions')
      .select('id, title, sections, linked_policies, revision, status, published_at')
      .eq('site_id', site_id)
      .eq('company_id', company_id)
      .eq('status', 'published')
      .maybeSingle();
    if (!ai) return res.json({ data: null });

    // Client approval for current revision
    const { data: approval } = await supabase
      .from('site_ai_client_approvals')
      .select('approved_by_name, approved_by_email, approved_at')
      .eq('ai_id', ai.id)
      .eq('revision', ai.revision)
      .maybeSingle();

    res.json({
      data: {
        ...ai,
        client_approved: !!approval,
        client_approved_by: approval?.approved_by_name || null,
        client_approved_at: approval?.approved_at || null,
      }
    });
  } catch (err) { next(err); }
});

// ── POST /api/portal/assignment-instructions/approve — client approves AI ─────
router.post('/assignment-instructions/approve', portalAuth, async (req, res, next) => {
  try {
    const { site_id, company_id } = req.portalSession;
    const { name, email } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Approver name is required' });

    const { data: ai } = await supabase
      .from('site_assignment_instructions')
      .select('id, revision')
      .eq('site_id', site_id)
      .eq('company_id', company_id)
      .eq('status', 'published')
      .maybeSingle();
    if (!ai) return res.status(404).json({ error: 'No published assignment instructions for this site' });

    const { data, error } = await supabase
      .from('site_ai_client_approvals')
      .insert({
        ai_id: ai.id,
        site_id,
        revision: ai.revision,
        approved_by_name: name.trim(),
        approved_by_email: email || null,
        ip_address: req.headers['x-forwarded-for'] || req.ip,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.json({ data: { already: true } });
      throw error;
    }
    res.json({ data });
  } catch (err) { next(err); }
});

// ── GET /api/portal/codes — read-only site codes ─────────────────────────────
router.get('/codes', portalAuth, async (req, res, next) => {
  try {
    const { site_id, company_id } = req.portalSession;
    const { data, error } = await supabase
      .from('site_codes')
      .select('id, label, code, code_type, notes')
      .eq('site_id', site_id)
      .eq('company_id', company_id)
      .order('label');
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (err) { next(err); }
});

// ── GET /api/portal/subcontractor-documents — shared docs for this site ──────
router.get('/subcontractor-documents', portalAuth, async (req, res, next) => {
  try {
    const { site_id, company_id } = req.portalSession;
    const { data, error } = await supabase
      .from('subcontractor_documents')
      .select('id, name, original_name, doc_type, mime_type, file_size, created_at, subcontractor:subcontractors!subcontractor_documents_subcontractor_id_fkey(company_name, service_type)')
      .eq('site_id', site_id)
      .eq('company_id', company_id)
      .eq('share_to_portal', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (err) { next(err); }
});

// ── GET /api/portal/subcontractor-documents/:id/signed — signed URL for portal doc ──
router.get('/subcontractor-documents/:id/signed', portalAuth, async (req, res, next) => {
  try {
    const { site_id, company_id } = req.portalSession;
    const { data: doc } = await supabase
      .from('subcontractor_documents')
      .select('storage_path')
      .eq('id', req.params.id)
      .eq('site_id', site_id)
      .eq('company_id', company_id)
      .eq('share_to_portal', true)
      .single();
    if (!doc?.storage_path) return res.status(404).json({ error: 'Not found' });
    if (doc.storage_path.startsWith('http')) return res.json({ data: { url: doc.storage_path } });
    const { data: s, error } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 300);
    if (error || !s?.signedUrl) return res.status(404).json({ error: 'File not found' });
    res.json({ data: { url: s.signedUrl } });
  } catch (err) { next(err); }
});

// ── POST /api/portal/expected-visitors — client books expected visitor(s) ────
router.post('/expected-visitors', portalAuth, async (req, res, next) => {
  try {
    const { site_id, company_id } = req.portalSession;
    const { visitor_name, company_name, who_visiting, expected_from, expected_to, expected_time, personnel_count, vehicle_reg, notes } = req.body;
    if (!visitor_name || !expected_from || !expected_to) return res.status(400).json({ error: 'visitor_name, expected_from and expected_to are required' });

    const result = expandBookingDays(expected_from, expected_to);
    if (result.error) return res.status(400).json({ error: result.error, message: result.message });

    const booking_group_id = crypto.randomUUID();
    const rows = result.days.map(day => ({
      company_id,
      site_id,
      visitor_name,
      company_name: company_name || null,
      who_visiting: who_visiting || null,
      vehicle_reg: vehicle_reg || null,
      personnel_count: parseInt(personnel_count) || 1,
      visit_type: 'contractor',
      notes: notes || null,
      expected_date: day,
      expected_time: expected_time || null,
      booking_group_id,
      status: 'expected',
      time_in: null,
      created_by_source: 'portal',
      created_by: null,
    }));

    const { data, error } = await supabase.from('visitors').insert(rows).select();
    if (error) throw error;
    res.status(201).json({ data: { booking_group_id, days: result.days.length } });
  } catch (err) { next(err); }
});

// ── GET /api/portal/expected-visitors — list expected visitors for this site ──
router.get('/expected-visitors', portalAuth, async (req, res, next) => {
  try {
    const { site_id, company_id } = req.portalSession;
    const { data, error } = await supabase
      .from('visitors')
      .select('id, visitor_name, company_name, who_visiting, vehicle_reg, personnel_count, expected_date, expected_time, booking_group_id, status, notes, time_in')
      .eq('company_id', company_id)
      .eq('site_id', site_id)
      .not('expected_date', 'is', null)
      .order('expected_date', { ascending: false })
      .order('expected_time', { ascending: true, nullsFirst: false });
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// ── PATCH /api/portal/expected-visitors/booking/:groupId — client edits expected visit ──
router.patch('/expected-visitors/booking/:groupId', portalAuth, async (req, res, next) => {
  try {
    const { site_id, company_id } = req.portalSession;
    const allowed = ['visitor_name', 'company_name', 'who_visiting', 'expected_time', 'personnel_count', 'vehicle_reg', 'notes'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const { data, error } = await supabase
      .from('visitors')
      .update(updates)
      .eq('booking_group_id', req.params.groupId)
      .eq('company_id', company_id)
      .eq('site_id', site_id)
      .eq('status', 'expected')
      .select('id');
    if (error) throw error;
    res.json({ data: { updated: (data || []).length } });
  } catch (err) { next(err); }
});

// ── DELETE /api/portal/expected-visitors/booking/:groupId — client cancels future expected visits ──
router.delete('/expected-visitors/booking/:groupId', portalAuth, async (req, res, next) => {
  try {
    const { site_id, company_id } = req.portalSession;
    const { data, error } = await supabase
      .from('visitors')
      .update({ status: 'cancelled' })
      .eq('booking_group_id', req.params.groupId)
      .eq('company_id', company_id)
      .eq('site_id', site_id)
      .eq('status', 'expected')
      .gte('expected_date', new Date().toISOString().slice(0, 10))
      .select('id');
    if (error) throw error;
    res.json({ data: { cancelled: (data || []).length } });
  } catch (err) { next(err); }
});

module.exports = router;
