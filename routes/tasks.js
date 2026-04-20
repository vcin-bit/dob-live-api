const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, assigned_to } = req.query;
    let query = supabase
      .from('tasks')
      .select(`*, assigned_by_user:users!tasks_assigned_by_fkey(id, first_name, last_name), assigned_to_user:users!tasks_assigned_to_fkey(id, first_name, last_name), site:sites(id, name), comments:task_comments(*, author:users(id, first_name, last_name))`)
      .eq('company_id', req.user.company_id)
      .order('created_at', { ascending: false });

    if (req.user.role === 'OFFICER') query = query.eq('assigned_to', req.user.id);
    else if (assigned_to) query = query.eq('assigned_to', assigned_to);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const { site_id, assigned_to, title, description, due_date, urgency } = req.body;
    const { data, error } = await supabase
      .from('tasks')
      .insert({ company_id: req.user.company_id, assigned_by: req.user.id, site_id, assigned_to, title, description, due_date, urgency: urgency || 'normal' })
      .select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const allowed = ['title', 'description', 'status', 'due_date', 'assigned_to', 'urgency', 'comments'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', req.params.id).eq('company_id', req.user.company_id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/:id/comments', authenticate, async (req, res, next) => {
  try {
    const { body } = req.body;
    const { data, error } = await supabase
      .from('task_comments')
      .insert({ task_id: req.params.id, author_id: req.user.id, body })
      .select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
