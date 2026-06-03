const router = require('express').Router();
const multer = require('multer');
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('company_policies')
      .select('*')
      .eq('company_id', req.user.company_id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data: data || { sections: [] } });
  } catch (err) { next(err); }
});

router.put('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'FD'), async (req, res, next) => {
  try {
    const { sections } = req.body;
    const { data, error } = await supabase
      .from('company_policies')
      .upsert({ company_id: req.user.company_id, sections, updated_by: req.user.id, updated_at: new Date().toISOString() }, { onConflict: 'company_id' })
      .select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/policies/upload — upload a policy PDF
router.post('/upload', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'FD'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const { title } = req.body;
    const ext = req.file.originalname.split('.').pop() || 'pdf';
    const path = `policies/${req.user.company_id}/${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });
    if (uploadErr) throw uploadErr;

    // Get current sections and add the uploaded doc
    const { data: policy } = await supabase.from('company_policies').select('sections').eq('company_id', req.user.company_id).single();
    const sections = policy?.sections || [];
    sections.push({
      title: title || req.file.originalname,
      content: '',
      type: 'document',
      file_name: req.file.originalname,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      storage_path: path,
      uploaded_at: new Date().toISOString(),
    });

    const { data, error } = await supabase
      .from('company_policies')
      .upsert({ company_id: req.user.company_id, sections, updated_by: req.user.id, updated_at: new Date().toISOString() }, { onConflict: 'company_id' })
      .select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// GET /api/policies/download/:index — get signed URL for a policy document
router.get('/download/:index', authenticate, async (req, res, next) => {
  try {
    const { data: policy } = await supabase.from('company_policies').select('sections').eq('company_id', req.user.company_id).single();
    const sec = policy?.sections?.[parseInt(req.params.index)];
    if (!sec?.storage_path) return res.status(404).json({ error: 'Document not found' });

    const { data: signed, error } = await supabase.storage.from('documents').createSignedUrl(sec.storage_path, 300);
    if (error || !signed?.signedUrl) return res.status(404).json({ error: 'File not found in storage' });
    res.json({ url: signed.signedUrl });
  } catch (err) { next(err); }
});

module.exports = router;
