const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── Named patrol routes ───────────────────────────────────────────────────────

// GET /api/patrols/routes?site_id=
router.get('/routes', authenticate, async (req, res, next) => {
  try {
    const { site_id } = req.query;
    let q = supabase.from('named_patrol_routes')
      .select('*, checkpoints:named_patrol_checkpoints(*)')
      .eq('company_id', req.user.company_id)
      .order('name');
    if (site_id) q = q.eq('site_id', site_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/patrols/routes
router.post('/routes', authenticate, async (req, res, next) => {
  try {
    if (!req.user.is_route_planner && !['COMPANY','SUPER_ADMIN','OPS_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Route planner permission required' });
    }
    const { site_id, name, instructions, checkpoints } = req.body;
    const { data: route, error } = await supabase.from('named_patrol_routes')
      .insert({ company_id: req.user.company_id, site_id, name, instructions: instructions || '' })
      .select().single();
    if (error) throw error;
    if (checkpoints?.length) {
      const rows = checkpoints.map((cp, i) => ({
        route_id: route.id, name: cp.name, instructions: cp.instructions || '',
        order_index: cp.order_index ?? i, lat: cp.lat || null, lng: cp.lng || null,
        image_url: cp.image_url || null, what_to_look_for: cp.what_to_look_for || null,
      }));
      await supabase.from('named_patrol_checkpoints').insert(rows);
    }
    const { data: full } = await supabase.from('named_patrol_routes')
      .select('*, checkpoints:named_patrol_checkpoints(*)').eq('id', route.id).single();
    res.status(201).json({ data: full });
  } catch (err) { next(err); }
});

// PUT /api/patrols/routes/:id
router.put('/routes/:id', authenticate, async (req, res, next) => {
  try {
    if (!req.user.is_route_planner && !['COMPANY','SUPER_ADMIN','OPS_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Route planner permission required' });
    }
    const { name, instructions, checkpoints } = req.body;
    await supabase.from('named_patrol_routes')
      .update({ name, instructions }).eq('id', req.params.id).eq('company_id', req.user.company_id);
    await supabase.from('named_patrol_checkpoints').delete().eq('route_id', req.params.id);
    if (checkpoints?.length) {
      const rows = checkpoints.map((cp, i) => ({
        route_id: req.params.id, name: cp.name, instructions: cp.instructions || '',
        order_index: cp.order_index ?? i, lat: cp.lat || null, lng: cp.lng || null,
        image_url: cp.image_url || null, what_to_look_for: cp.what_to_look_for || null,
      }));
      await supabase.from('named_patrol_checkpoints').insert(rows);
    }
    const { data } = await supabase.from('named_patrol_routes')
      .select('*, checkpoints:named_patrol_checkpoints(*)').eq('id', req.params.id).single();
    res.json({ data });
  } catch (err) { next(err); }
});

// DELETE /api/patrols/routes/:id
router.delete('/routes/:id', authenticate, requireRole('SUPER_ADMIN','COMPANY','OPS_MANAGER'), async (req, res, next) => {
  try {
    await supabase.from('named_patrol_routes').delete().eq('id', req.params.id).eq('company_id', req.user.company_id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Patrol sessions ────────────────────────────────────────────────────────────

// POST /api/patrols/sessions/start
// GET /api/patrols/sessions/active — get officer's current active session
router.get('/sessions/active', authenticate, async (req, res, next) => {
  try {
    const { site_id } = req.query;
    const { data } = await supabase
      .from('patrol_sessions')
      .select('*')
      .eq('officer_id', req.user.id)
      .eq('status', 'ACTIVE')
      .eq('site_id', site_id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    res.json({ data: data || null });
  } catch (err) {
    // Return null rather than crashing - patrol screen should still load
    res.json({ data: null });
  }
});

// GET /api/patrols/sessions/:id — get full session detail
router.get('/sessions/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('patrol_sessions')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Session not found' });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/sessions/start', authenticate, async (req, res, next) => {
  try {
    const { site_id, route_id } = req.body;
    // End any existing active session
    await supabase.from('patrol_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('officer_id', req.user.id).eq('status', 'active');
    const { data, error } = await supabase.from('patrol_sessions').insert({
      company_id: req.user.company_id, site_id, route_id: route_id || null,
      officer_id: req.user.id, status: 'active',
    }).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PATCH /api/patrols/sessions/:id/gps - append GPS point
router.patch('/sessions/:id/gps', authenticate, async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    const { data: session } = await supabase.from('patrol_sessions').select('gps_trail').eq('id', req.params.id).single();
    const trail = session?.gps_trail || [];
    trail.push({ lat, lng, ts: new Date().toISOString() });
    await supabase.from('patrol_sessions').update({ gps_trail: trail }).eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PATCH /api/patrols/sessions/:id/checkpoint - mark checkpoint reached
router.patch('/sessions/:id/checkpoint', authenticate, async (req, res, next) => {
  try {
    const { checkpoint_id, checkpoint_name, lat, lng } = req.body;
    const { data: session } = await supabase.from('patrol_sessions').select('checkpoints_completed').eq('id', req.params.id).single();
    const completed = session?.checkpoints_completed || [];
    completed.push({ checkpoint_id, checkpoint_name, lat, lng, ts: new Date().toISOString() });
    await supabase.from('patrol_sessions').update({ checkpoints_completed: completed }).eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/patrols/sessions/:id/end
router.post('/sessions/:id/end', authenticate, async (req, res, next) => {
  try {
    const endedAt = new Date().toISOString();
    const { data, error } = await supabase.from('patrol_sessions')
      .update({ status: 'completed', ended_at: endedAt })
      .eq('id', req.params.id).eq('officer_id', req.user.id).select().single();
    if (error) throw error;

    // Create summary log entry
    try {
      const completedCount = data.checkpoints_completed?.length || 0;
      const startedAt = data.started_at || data.created_at;
      const durationMins = startedAt ? Math.round((new Date(endedAt) - new Date(startedAt)) / 60000) : 0;
      await supabase.from('occurrence_logs').insert({
        company_id: req.user.company_id,
        officer_id: req.user.id,
        site_id: data.site_id,
        log_type: 'PATROL',
        title: 'Patrol Completed',
        description: `Patrol completed in ${durationMins} minutes. ${completedCount} checkpoint(s) reached.`,
        occurred_at: endedAt,
        type_data: {
          patrol_session_id: data.id,
          started_at: startedAt,
          ended_at: endedAt,
          duration_minutes: durationMins,
          checkpoints_completed: data.checkpoints_completed || [],
          route_id: data.route_id,
        },
      });
    } catch (logErr) { console.error('Failed to create patrol summary log:', logErr.message); }

    res.json({ data });
  } catch (err) { next(err); }
});

// ── Media upload ───────────────────────────────────────────────────────────────

// POST /api/patrols/media/upload
router.post('/media/upload', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = req.file.originalname.split('.').pop();
    const path = `${req.user.company_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('patrol-media').upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('patrol-media').getPublicUrl(path);
    res.json({ url: publicUrl, path });
  } catch (err) { next(err); }
});

// POST /api/patrols/checkpoint-image — upload checkpoint photo
router.post('/checkpoint-image', authenticate, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const path = `checkpoints/${req.user.company_id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('patrol-media').upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('patrol-media').getPublicUrl(path);
    res.json({ url: publicUrl });
  } catch (err) { next(err); }
});

module.exports = router;
