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

router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { site_id, name, description } = req.body;
    const { data, error } = await supabase.from('site_folders').insert({ company_id: req.user.company_id, site_id, name, description, created_by: req.user.id }).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
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

router.post('/documents', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { site_id, folder_id, name, original_name, mime_type, file_size, storage_path } = req.body;
    const { data, error } = await supabase.from('site_documents').insert({ company_id: req.user.company_id, site_id, folder_id, name, original_name, mime_type, file_size, storage_path, uploaded_by: req.user.id }).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// GET signed URL for a document
router.get('/documents/:id/signed', authenticate, async (req, res, next) => {
  try {
    const { data: doc, error } = await supabase.from('site_documents').select('storage_path').eq('id', req.params.id).eq('company_id', req.user.company_id).single();
    if (error || !doc?.storage_path) return res.status(404).json({ error: 'Document not found' });
    // Try hr-documents bucket first (inspections), then patrol-media
    let signed;
    const { data: s1, error: e1 } = await supabase.storage.from('hr-documents').createSignedUrl(doc.storage_path, 300);
    if (!e1 && s1?.signedUrl) { signed = s1; }
    else {
      const { data: s2, error: e2 } = await supabase.storage.from('patrol-media').createSignedUrl(doc.storage_path, 300);
      if (!e2 && s2?.signedUrl) signed = s2;
    }
    if (!signed) return res.status(404).json({ error: 'File not found in storage' });
    res.json({ data: { url: signed.signedUrl } });
  } catch (err) { next(err); }
});

router.delete('/documents/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { error } = await supabase.from('site_documents').delete().eq('id', req.params.id).eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
