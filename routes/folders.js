const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

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

// POST /api/folders/documents/upload — upload file to storage via server
router.post('/documents/upload', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const site_id = req.body.site_id;
    const folder_id = req.body.folder_id || 'root';
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${site_id}/${folder_id}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('documents').upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });
    if (error) throw error;
    res.json({ path, name: req.file.originalname, mime_type: req.file.mimetype, file_size: req.file.size });
  } catch (err) { next(err); }
});

// GET signed URL for a document
router.get('/documents/:id/signed', authenticate, async (req, res, next) => {
  try {
    const { data: doc, error } = await supabase.from('site_documents').select('storage_path').eq('id', req.params.id).eq('company_id', req.user.company_id).single();
    if (error || !doc?.storage_path) return res.status(404).json({ error: 'Document not found' });
    // External URL or data URI — return directly (legacy migration artefacts)
    if (doc.storage_path.startsWith('http://') || doc.storage_path.startsWith('https://') || doc.storage_path.startsWith('data:')) {
      return res.json({ data: { url: doc.storage_path } });
    }
    // Try each bucket until we find the file
    let signed;
    for (const bucket of ['documents', 'hr-documents', 'patrol-media']) {
      const { data: s, error: e } = await supabase.storage.from(bucket).createSignedUrl(doc.storage_path, 300);
      if (!e && s?.signedUrl) { signed = s; break; }
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
