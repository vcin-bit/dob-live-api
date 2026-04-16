const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { site_id } = req.query;
    let query = supabase
      .from('documents')
      .select(`*, uploader:users(id, first_name, last_name), site:sites(id, name)`)
      .eq('company_id', req.user.company_id)
      .order('created_at', { ascending: false });
    if (site_id) query = query.eq('site_id', site_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { site_id, document_type, file_name, storage_path, file_size_bytes } = req.body;
    const { data, error } = await supabase
      .from('documents')
      .insert({ company_id: req.user.company_id, uploaded_by: req.user.id, site_id, document_type, file_name, storage_path, file_size_bytes })
      .select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const { error } = await supabase.from('documents').delete().eq('id', req.params.id).eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
