const router = require('express').Router();
const multer = require('multer');
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/hr — get my HR record
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('officer_hr')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    res.json({ data: data || null });
  } catch (err) { next(err); }
});

// GET /api/hr/:userId — manager view of officer HR (restricted roles)
router.get('/:userId', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('officer_hr')
      .select('*')
      .eq('user_id', req.params.userId)
      .maybeSingle();
    if (error) throw error;
    res.json({ data: data || null });
  } catch (err) { next(err); }
});

// PUT /api/hr — upsert my HR record
router.put('/', authenticate, async (req, res, next) => {
  try {
    const {
      nok_name, nok_relationship, nok_phone,
      address_line_1, address_line_2, city, postcode,
      date_of_birth, ni_number,
      employment_status, utr_number,
      company_name, company_address, company_vat_number, company_reg_number,
      gdpr_consent, gdpr_consent_at,
    } = req.body;

    const record = {
      user_id: req.user.id,
      company_id: req.user.company_id,
      nok_name: nok_name || null,
      nok_relationship: nok_relationship || null,
      nok_phone: nok_phone || null,
      address_line_1: address_line_1 || null,
      address_line_2: address_line_2 || null,
      city: city || null,
      postcode: postcode || null,
      date_of_birth: date_of_birth || null,
      ni_number: ni_number || null,
      employment_status: employment_status || null,
      utr_number: utr_number || null,
      company_name: company_name || null,
      company_address: company_address || null,
      company_vat_number: company_vat_number || null,
      company_reg_number: company_reg_number || null,
      gdpr_consent: gdpr_consent || false,
      gdpr_consent_at: gdpr_consent_at || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('officer_hr')
      .upsert(record, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/hr/documents — upload HR document (SIA photo, DBS cert)
router.post('/documents', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { doc_type } = req.body; // sia_front, sia_back, dbs_certificate
    if (!doc_type) return res.status(400).json({ error: 'doc_type required' });

    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const path = `${req.user.company_id}/${req.user.id}/${doc_type}_${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('hr-documents')
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (uploadErr) throw uploadErr;

    // Save reference in officer_hr
    const field = `${doc_type}_path`;
    const { error: updateErr } = await supabase
      .from('officer_hr')
      .upsert(
        { user_id: req.user.id, company_id: req.user.company_id, [field]: path, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    if (updateErr) throw updateErr;

    res.json({ path, doc_type });
  } catch (err) { next(err); }
});

// GET /api/hr/documents/:docType — get signed URL for a document
router.get('/documents/:docType', authenticate, async (req, res, next) => {
  try {
    const userId = req.query.user_id || req.user.id;

    // Officers can only view their own; managers can view any in their company
    if (userId !== req.user.id && !['SUPER_ADMIN','COMPANY','OPS_MANAGER','FD'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: hr, error } = await supabase
      .from('officer_hr')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;

    const field = `${req.params.docType}_path`;
    const path = hr?.[field];
    if (!path) return res.status(404).json({ error: 'Document not found' });

    const { data: signedData, error: signErr } = await supabase.storage
      .from('hr-documents')
      .createSignedUrl(path, 300); // 5 minute expiry
    if (signErr) throw signErr;

    res.json({ url: signedData.signedUrl, expires_in: 300 });
  } catch (err) { next(err); }
});

// DELETE /api/hr/documents/:docType — remove a document (right to erasure)
router.delete('/documents/:docType', authenticate, async (req, res, next) => {
  try {
    const { data: hr } = await supabase
      .from('officer_hr')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    const field = `${req.params.docType}_path`;
    const path = hr?.[field];
    if (path) {
      await supabase.storage.from('hr-documents').remove([path]);
    }

    await supabase
      .from('officer_hr')
      .update({ [field]: null, updated_at: new Date().toISOString() })
      .eq('user_id', req.user.id);

    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
