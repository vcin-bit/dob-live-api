const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// Folders
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { site_id } = req.query;
    let query = supabase.from('site_folders').select('*, documents:site_documents(id)').eq('company_id', req.user.company_id).order('name');
    if (site_id) query = query.eq('site_id', site_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const { site_id, name, description } = req.body;
    const { data, error } = await supabase.from('site_folders').insert({ company_id: req.user.company_id, site_id, name, description, created_by: req.user.id }).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const { error } = await supabase.from('site_folders').delete().eq('id', req.params.id).eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Documents
router.get('/documents', authenticate, async (req, res, next) => {
  try {
    const { folder_id, site_id } = req.query;
    let query = supabase.from('site_documents').select('*, uploader:users(id, first_name, last_name)').eq('company_id', req.user.company_id).order('created_at', { ascending: false });
    if (folder_id) query = query.eq('folder_id', folder_id);
    if (site_id)   query = query.eq('site_id', site_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/documents', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const { site_id, folder_id, name, original_name, mime_type, file_size, storage_path } = req.body;
    const { data, error } = await supabase.from('site_documents').insert({ company_id: req.user.company_id, site_id, folder_id, name, original_name, mime_type, file_size, storage_path, uploaded_by: req.user.id }).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.delete('/documents/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER'), async (req, res, next) => {
  try {
    const { error } = await supabase.from('site_documents').delete().eq('id', req.params.id).eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
