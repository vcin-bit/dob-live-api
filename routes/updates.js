const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/updates — list company updates
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('company_updates')
      .select('*, author:users(id, first_name, last_name, role)')
      .eq('company_id', req.user.company_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/updates — create update (managers/MD only)
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
    const { data, error } = await supabase
      .from('company_updates')
      .insert({ company_id: req.user.company_id, author_id: req.user.id, title, content })
      .select('*, author:users(id, first_name, last_name, role)')
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// DELETE /api/updates/:id — delete update (managers only)
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { error } = await supabase.from('company_updates').delete()
      .eq('id', req.params.id).eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/updates/:id/comments — list comments for an update
router.get('/:id/comments', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('company_update_comments')
      .select('*, user:users(id, first_name, last_name, role)')
      .eq('update_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/updates/:id/comments — add comment
router.post('/:id/comments', authenticate, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Comment required' });
    const { data, error } = await supabase
      .from('company_update_comments')
      .insert({ update_id: req.params.id, user_id: req.user.id, content: content.trim() })
      .select('*, user:users(id, first_name, last_name, role)')
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
