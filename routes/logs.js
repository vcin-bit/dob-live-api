const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/logs — all logs for company (with filters)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { site_id, log_type, officer_id, shift_id, from, to, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('occurrence_logs')
      .select(`
        *,
        officer:users(id, first_name, last_name),
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
        officer:users(id, first_name, last_name),
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
        type_data: { ...(type_data||{}), media: media||[], police_attended, police_reported, police_incident_number, police_force, police_officer_name, police_shoulder_number }
      })
      .select()
      .single();

    if (error) throw error;
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

    const allowed = ['title', 'description', 'type_data', 'latitude', 'longitude', 'what3words'];
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
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
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
      .select('*, officer:users(first_name,last_name), site:sites(name)')
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

module.exports = router;
