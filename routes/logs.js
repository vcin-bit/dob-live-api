const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendSms, sendEmail } = require('../services/notifications');

// Guard against double-firing on retries (process-lifetime, resets on deploy)
const notifiedIds = new Set();

// ── Incident notification ────────────────────────────────────────────────────
async function fireIncidentNotification(log, officerId, siteId) {
  try {
    // Fetch officer name and site name (minimal lookups)
    const [officerRes, siteRes] = await Promise.all([
      supabase.from('users').select('first_name, last_name').eq('id', officerId).single(),
      siteId ? supabase.from('sites').select('name').eq('id', siteId).single() : Promise.resolve({ data: null }),
    ]);

    const firstName = officerRes.data?.first_name || '';
    const lastName  = officerRes.data?.last_name  || '';
    const siteName  = siteRes.data?.name          || 'Unknown site';

    const occurredAt = new Date(log.occurred_at || new Date());
    const hhmm = occurredAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    const fullDateTime = occurredAt.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

    const logUrl = `https://app.doblive.co.uk/logs/${log.id}`;
    const titleTrunc = (log.title || '').slice(0, 40);

    // SMS (must be under 160 chars)
    const smsTo = process.env.INCIDENT_ALERT_PHONE || process.env.ESCALATION_PHONE_1 || '+447587865219';
    const smsBody = `INCIDENT - ${siteName} - ${firstName} ${lastName} - ${hhmm} - ${titleTrunc} ${logUrl}`;
    await sendSms({ to: smsTo, body: smsBody });

    // Email
    const emailTo = process.env.INCIDENT_ALERT_EMAIL || 'david@risksecured.co.uk';
    const locationLines = [
      log.what3words ? `<tr><td style="padding:4px 0;font-weight:600;width:130px;">What3Words:</td><td>///&#8203;${log.what3words}</td></tr>` : '',
      (log.latitude != null && log.longitude != null)
        ? `<tr><td style="padding:4px 0;font-weight:600;">GPS:</td><td>${Number(log.latitude).toFixed(6)}, ${Number(log.longitude).toFixed(6)}</td></tr>`
        : '',
    ].join('');

    await sendEmail({
      to: emailTo,
      subject: `Incident Report - ${siteName} - ${hhmm}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0b1a3e;padding:20px 24px;border-radius:8px 8px 0 0;border-top:4px solid #dc2626;">
            <h1 style="color:#fff;margin:0;font-size:18px;">Incident Report</h1>
            <p style="color:#8899bb;margin:4px 0 0;font-size:12px;">DOB Live — Ops Notification</p>
          </div>
          <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;background:#fff;">
            <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
              <tr><td style="padding:4px 0;font-weight:600;width:130px;">Site:</td><td>${siteName}</td></tr>
              <tr><td style="padding:4px 0;font-weight:600;">Officer:</td><td>${firstName} ${lastName}</td></tr>
              <tr><td style="padding:4px 0;font-weight:600;">Date &amp; Time:</td><td>${fullDateTime}</td></tr>
              <tr><td style="padding:4px 0;font-weight:600;">Title:</td><td>${log.title || '—'}</td></tr>
              ${locationLines}
            </table>
            ${log.description ? `
            <div style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;">
              <div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Description</div>
              <div style="font-size:14px;color:#1e293b;line-height:1.6;">${log.description}</div>
            </div>` : ''}
            <div style="margin-top:20px;">
              <a href="${logUrl}" style="display:inline-block;background:#1a52a8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">View Incident Log</a>
            </div>
          </div>
        </div>
      `,
    });
  } catch (e) {
    console.error('[incident-notification] Unexpected error:', e.message);
  }
}

// GET /api/logs — all logs for company (with filters)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { site_id, log_type, officer_id, shift_id, from, to, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('occurrence_logs')
      .select(`
        *,
        officer:users!occurrence_logs_officer_id_fkey(id, first_name, last_name),
        site:sites(id, name),
        photos:occurrence_log_photos(id, storage_path, file_name)
      `)
      .eq('company_id', req.user.company_id)
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (site_id)   query = query.eq('site_id', site_id);
    if (log_type)  query = query.eq('log_type', log_type);
    if (shift_id)  query = query.eq('shift_id', shift_id);
    if (from)      query = query.gte('occurred_at', from);
    if (to)        query = query.lte('occurred_at', to);

    // Officers can only see their own logs
    if (req.user.role === 'OFFICER') {
      query = query.eq('officer_id', req.user.id);
    } else if (officer_id) {
      query = query.eq('officer_id', officer_id);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, count });
  } catch (err) { next(err); }
});

// GET /api/logs/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('occurrence_logs')
      .select(`
        *,
        officer:users!occurrence_logs_officer_id_fkey(id, first_name, last_name),
        site:sites(id, name),
        photos:occurrence_log_photos(id, storage_path, file_name)
      `)
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Log not found' });

    // Officers can only view their own logs
    if (req.user.role === 'OFFICER' && data.officer_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/logs — create a new log entry
router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      site_id, shift_id, log_type, title, description,
      latitude, longitude, what3words, type_data, occurred_at,
      client_reportable, patrol_session_id, media,
      police_attended, police_reported, police_incident_number,
      police_force, police_officer_name, police_shoulder_number
    } = req.body;

    const { data, error } = await supabase
      .from('occurrence_logs')
      .insert({
        company_id: req.user.company_id,
        officer_id: req.user.id,
        site_id,
        shift_id,
        log_type,
        title,
        description,
        latitude,
        longitude,
        what3words,
        occurred_at: occurred_at || new Date().toISOString(),
        client_reportable: client_reportable || false,
        type_data: { ...(type_data||{}), media: media ?? (type_data?.media || []), police_attended, police_reported, police_incident_number, police_force, police_officer_name, police_shoulder_number }
      })
      .select()
      .single();

    if (error) throw error;

    // Fire incident notification (fire-and-forget — must never block or fail the officer's response)
    if (data.log_type === 'INCIDENT' && !notifiedIds.has(data.id)) {
      notifiedIds.add(data.id);
      fireIncidentNotification(data, req.user.id, site_id).catch(e =>
        console.error('[incident-notification] fire-and-forget error:', e.message)
      );
    }

    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PATCH /api/logs/:id — update log (officer can edit own, managers can edit all)
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    // Verify ownership/permissions
    const { data: existing, error: fetchError } = await supabase
      .from('occurrence_logs')
      .select('officer_id, company_id')
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .single();

    if (fetchError || !existing) return res.status(404).json({ error: 'Log not found' });

    if (req.user.role === 'OFFICER' && existing.officer_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const allowed = ['title', 'description', 'type_data', 'latitude', 'longitude', 'what3words', 'review_status', 'next_action', 'resolution', 'client_informed', 'client_informed_at', 'more_details_required', 'reviewed_by', 'reviewed_at'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

    const { data, error } = await supabase
      .from('occurrence_logs')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// DELETE /api/logs/:id — managers only
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('occurrence_logs')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/logs/export — CSV download
router.get('/export', authenticate, async (req, res, next) => {
  try {
    const { site_id, log_type, from, to } = req.query;

    let query = supabase
      .from('occurrence_logs')
      .select('*, officer:users!occurrence_logs_officer_id_fkey(first_name,last_name), site:sites(name)')
      .eq('company_id', req.user.company_id)
      .order('occurred_at', { ascending: false })
      .limit(5000);

    if (req.user.role === 'OFFICER') query = query.eq('officer_id', req.user.id);
    if (site_id)  query = query.eq('site_id', site_id);
    if (log_type) query = query.eq('log_type', log_type);
    if (from)     query = query.gte('occurred_at', from);
    if (to)       query = query.lte('occurred_at', to);

    const { data, error } = await query;
    if (error) throw error;

    const escape = v => '"' + String(v || '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';

    const headers = ['Date','Time','Type','Title','Description','Officer','Site'];
    const rows = (data || []).map(l => [
      new Date(l.occurred_at).toLocaleDateString('en-GB'),
      new Date(l.occurred_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      l.log_type || '',
      l.title || '',
      l.description || '',
      l.officer ? (l.officer.first_name + ' ' + l.officer.last_name) : '',
      l.site ? l.site.name : '',
    ]);

    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="doblive-logs.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

// POST /api/logs/:id/photos — register an uploaded photo against a log entry
router.post('/:id/photos', authenticate, async (req, res, next) => {
  try {
    const { storage_path, file_name } = req.body;
    if (!storage_path) return res.status(400).json({ error: 'storage_path required' });

    const { data: log, error: logErr } = await supabase
      .from('occurrence_logs')
      .select('id')
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .single();

    if (logErr || !log) return res.status(404).json({ error: 'Log not found' });

    const { data, error } = await supabase
      .from('occurrence_log_photos')
      .insert({ log_id: req.params.id, storage_path, file_name: file_name || null })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// GET /api/logs/:id/comments
router.get('/:id/comments', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('log_comments')
      .select('*, user:users(id, first_name, last_name)')
      .eq('log_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/logs/:id/comments
router.post('/:id/comments', authenticate, async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment?.trim()) return res.status(400).json({ error: 'Comment is required' });
    const { data, error } = await supabase
      .from('log_comments')
      .insert({ log_id: req.params.id, user_id: req.user.id, comment: comment.trim() })
      .select('*, user:users(id, first_name, last_name)')
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
