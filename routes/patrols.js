const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { site_id } = req.query;
    let q = supabase.from('named_patrol_routes').select('*, checkpoints:patrol_checkpoints(*)').eq('company_id', req.user.company_id).order('name');
    if (site_id) q = q.eq('site_id', site_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const { site_id, name, instructions, checkpoints = [] } = req.body;
    const { data: route, error } = await supabase.from('named_patrol_routes').insert({ company_id: req.user.company_id, site_id, name, instructions, created_by: req.user.id }).select().single();
    if (error) throw error;
    if (checkpoints.length > 0) {
      const rows = checkpoints.map((c, i) => ({ route_id: route.id, name: c.name, instructions: c.instructions, lat: c.lat, lng: c.lng, order_index: i, alert_sound: c.alert_sound !== false }));
      await supabase.from('named_patrol_checkpoints').insert(rows);
    }
    res.status(201).json({ data: route });
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const { name, instructions, checkpoints } = req.body;
    const { data, error } = await supabase.from('named_patrol_routes').update({ name, instructions }).eq('id', req.params.id).eq('company_id', req.user.company_id).select().single();
    if (error) throw error;
    if (checkpoints) {
      await supabase.from('named_patrol_checkpoints').delete().eq('route_id', req.params.id);
      if (checkpoints.length > 0) {
        const rows = checkpoints.map((c, i) => ({ route_id: req.params.id, name: c.name, instructions: c.instructions, lat: c.lat, lng: c.lng, order_index: i, alert_sound: c.alert_sound !== false }));
        await supabase.from('named_patrol_checkpoints').insert(rows);
      }
    }
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const { error } = await supabase.from('named_patrol_routes').delete().eq('id', req.params.id).eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
