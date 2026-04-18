const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

const OPS = ['SUPER_ADMIN','COMPANY','OPS_MANAGER'];

// GET /api/playbooks/:siteId — get full playbook for a site
router.get('/:siteId', authenticate, async (req, res, next) => {
  try {
    const { siteId } = req.params;
    const [pb, tasks, checks] = await Promise.all([
      supabase.from('site_playbooks').select('*').eq('site_id', siteId).eq('company_id', req.user.company_id).maybeSingle(),
      supabase.from('site_scheduled_tasks').select('*').eq('site_id', siteId).eq('company_id', req.user.company_id).eq('active', true).order('sort_order'),
      supabase.from('site_standing_checks').select('*').eq('site_id', siteId).eq('company_id', req.user.company_id).eq('active', true).order('sort_order'),
    ]);
    res.json({ playbook: pb.data, tasks: tasks.data || [], checks: checks.data || [] });
  } catch (err) { next(err); }
});

// PUT /api/playbooks/:siteId — save patrol config
router.put('/:siteId', authenticate, requireRole(...OPS), async (req, res, next) => {
  try {
    const { siteId } = req.params;
    const { patrol_frequency_hours, patrol_type, patrol_reminder_minutes } = req.body;
    const { data, error } = await supabase.from('site_playbooks').upsert({
      site_id: siteId, company_id: req.user.company_id,
      patrol_frequency_hours, patrol_type, patrol_reminder_minutes, active: true,
    }, { onConflict: 'site_id' }).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/playbooks/:siteId/tasks — add scheduled task
router.post('/:siteId/tasks', authenticate, requireRole(...OPS), async (req, res, next) => {
  try {
    const { name, description, task_type, scheduled_time, days_of_week, contact_name, contact_phone, escalate_after_minutes, sort_order } = req.body;
    const { data, error } = await supabase.from('site_scheduled_tasks').insert({
      site_id: req.params.siteId, company_id: req.user.company_id,
      name, description, task_type, scheduled_time, days_of_week: days_of_week || [0,1,2,3,4,5,6],
      contact_name, contact_phone, escalate_after_minutes: escalate_after_minutes || 15, sort_order: sort_order || 0,
    }).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// DELETE /api/playbooks/:siteId/tasks/:taskId
router.delete('/:siteId/tasks/:taskId', authenticate, requireRole(...OPS), async (req, res, next) => {
  try {
    await supabase.from('site_scheduled_tasks').update({ active: false }).eq('id', req.params.taskId).eq('company_id', req.user.company_id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/playbooks/:siteId/checks — add standing check
router.post('/:siteId/checks', authenticate, requireRole(...OPS), async (req, res, next) => {
  try {
    const { description, sort_order } = req.body;
    const { data, error } = await supabase.from('site_standing_checks').insert({
      site_id: req.params.siteId, company_id: req.user.company_id,
      description, sort_order: sort_order || 0,
    }).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// DELETE /api/playbooks/:siteId/checks/:checkId
router.delete('/:siteId/checks/:checkId', authenticate, requireRole(...OPS), async (req, res, next) => {
  try {
    await supabase.from('site_standing_checks').update({ active: false }).eq('id', req.params.checkId).eq('company_id', req.user.company_id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
