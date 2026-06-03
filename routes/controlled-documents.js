const router = require('express').Router();
const multer = require('multer');
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const STATUSES = ['Planned', 'In Progress', 'Approved', 'Superseded', 'Archived'];
const AUDIENCES = ['Officer', 'Client', 'Internal'];

async function auditLog(documentId, action, performedBy, oldValue, newValue, notes) {
  await supabase.from('controlled_document_audit').insert({ document_id: documentId, action, performed_by: performedBy, old_value: oldValue, new_value: newValue, notes });
}

// GET /api/controlled-documents — list current docs
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { category, audience, status, include_superseded } = req.query;
    let query = supabase
      .from('controlled_documents')
      .select('*, owner:users!controlled_documents_owner_id_fkey(id, first_name, last_name)')
      .eq('company_id', req.user.company_id)
      .order('doc_number');
    if (!include_superseded) query = query.eq('is_current', true);
    if (category) query = query.eq('category', category);
    if (audience) query = query.eq('audience', audience);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/controlled-documents/alerts — docs due review ≤60 days or overdue
router.get('/alerts', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { count_only } = req.query;
    const cutoff = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('controlled_documents')
      .select('id, doc_number, title, review_date, status, owner:users!controlled_documents_owner_id_fkey(id, first_name, last_name)')
      .eq('company_id', req.user.company_id)
      .eq('is_current', true)
      .eq('status', 'Approved')
      .not('review_date', 'is', null)
      .lte('review_date', cutoff)
      .order('review_date');
    if (error) throw error;
    if (count_only === 'true') return res.json({ count: data?.length || 0 });
    const now = new Date().toISOString().split('T')[0];
    res.json({ data: (data || []).map(d => ({ ...d, overdue: d.review_date < now })) });
  } catch (err) { next(err); }
});

// GET /api/controlled-documents/register-export — CSV
router.get('/register-export', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'FD'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('controlled_documents')
      .select('*, owner:users!controlled_documents_owner_id_fkey(first_name, last_name)')
      .eq('company_id', req.user.company_id)
      .eq('is_current', true)
      .order('doc_number');
    if (error) throw error;
    const rows = [['Doc Number','Rev','Title','Category','Audience','Status','Owner','Issue Date','Review Date'].join(',')];
    for (const d of (data || [])) {
      rows.push([d.doc_number, d.revision, `"${d.title}"`, d.category, d.audience, d.status, d.owner ? `${d.owner.first_name} ${d.owner.last_name}` : '', d.issue_date || '', d.review_date || ''].join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="document-register.csv"');
    res.send(rows.join('\n'));
  } catch (err) { next(err); }
});

// GET /api/controlled-documents/training-feed — ack events as training evidence
router.get('/training-feed', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('controlled_document_acknowledgements')
      .select('user_id, doc_number, revision, acknowledged_at, document:controlled_documents(title)')
      .order('acknowledged_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    res.json({ data: (data || []).map(a => ({ user_id: a.user_id, doc_number: a.doc_number, revision: a.revision, title: a.document?.title, completed_at: a.acknowledged_at, source: 'document_control' })) });
  } catch (err) { next(err); }
});

// GET /api/controlled-documents/:id — single doc with audit + acks
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('controlled_documents')
      .select('*, owner:users!controlled_documents_owner_id_fkey(id, first_name, last_name)')
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Document not found' });

    const [auditRes, ackRes] = await Promise.all([
      supabase.from('controlled_document_audit').select('*, performer:users(first_name, last_name)').eq('document_id', req.params.id).order('performed_at', { ascending: false }),
      supabase.from('controlled_document_acknowledgements').select('*, user:users(first_name, last_name)').eq('document_id', req.params.id).order('acknowledged_at'),
    ]);
    res.json({ data: { ...data, audit: auditRes.data || [], acknowledgements: ackRes.data || [] } });
  } catch (err) { next(err); }
});

// POST /api/controlled-documents — create new doc
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { doc_number, title, category, audience, description, owner_id } = req.body;
    if (!doc_number || !title) return res.status(400).json({ error: 'doc_number and title required' });

    const { data, error } = await supabase.from('controlled_documents').insert({
      company_id: req.user.company_id, doc_number, revision: 1, title,
      category: category || 'Policy', audience: audience || 'Internal',
      description: description || null, status: 'Planned', is_current: true,
      owner_id: owner_id || req.user.id, created_by: req.user.id,
    }).select().single();
    if (error) throw error;
    await auditLog(data.id, 'Created', req.user.id, null, `${doc_number} - ${title}`);
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// POST /api/controlled-documents/:id/upload — upload/replace file
router.post('/:id/upload', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const { data: doc } = await supabase.from('controlled_documents').select('doc_number, revision, status').eq('id', req.params.id).eq('company_id', req.user.company_id).single();
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.status === 'Superseded' || doc.status === 'Archived') return res.status(400).json({ error: 'Cannot upload to a superseded or archived document' });

    const path = `controlled-docs/${req.user.company_id}/${doc.doc_number}/rev-${doc.revision}/${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (uploadErr) throw uploadErr;

    const { data, error } = await supabase.from('controlled_documents').update({
      file_name: req.file.originalname, file_size: req.file.size, mime_type: req.file.mimetype,
      storage_path: path, updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).select().single();
    if (error) throw error;
    await auditLog(req.params.id, 'Uploaded', req.user.id, null, req.file.originalname);
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/controlled-documents/:id/revise — create new revision
router.post('/:id/revise', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { data: old } = await supabase.from('controlled_documents').select('*').eq('id', req.params.id).eq('company_id', req.user.company_id).single();
    if (!old) return res.status(404).json({ error: 'Document not found' });

    // Mark old as superseded
    await supabase.from('controlled_documents').update({ is_current: false, status: 'Superseded', superseded_date: new Date().toISOString().split('T')[0], updated_at: new Date().toISOString() }).eq('id', old.id);

    // Create new revision
    const { data, error } = await supabase.from('controlled_documents').insert({
      company_id: old.company_id, doc_number: old.doc_number, revision: old.revision + 1,
      title: old.title, description: old.description, category: old.category, audience: old.audience,
      status: 'Planned', is_current: true, owner_id: old.owner_id, author_id: req.user.id,
      created_by: req.user.id, supersedes_id: old.id,
    }).select().single();
    if (error) throw error;
    await auditLog(old.id, 'Superseded', req.user.id, `Rev ${old.revision}`, `Rev ${old.revision + 1}`);
    await auditLog(data.id, 'Created', req.user.id, null, `Revision ${data.revision} of ${data.doc_number}`);
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PATCH /api/controlled-documents/:id/status — change status
router.patch('/:id/status', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'FD'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: `Invalid status. Must be: ${STATUSES.join(', ')}` });

    const { data: old } = await supabase.from('controlled_documents').select('status, issue_date, review_date').eq('id', req.params.id).eq('company_id', req.user.company_id).single();
    if (!old) return res.status(404).json({ error: 'Document not found' });

    const today = new Date().toISOString().split('T')[0];
    const updates = { status, updated_at: new Date().toISOString() };
    if (status === 'Approved') {
      updates.approved_date = today;
      updates.approver_id = req.user.id;
      updates.issue_date = req.body.issue_date || old.issue_date || today;
      updates.review_date = req.body.review_date || old.review_date || new Date(new Date(updates.issue_date).getTime() + 365 * 86400000).toISOString().split('T')[0];
    }
    if (status === 'Superseded') { updates.superseded_date = today; updates.is_current = false; }
    if (status === 'Archived') { updates.is_current = false; }

    const { data, error } = await supabase.from('controlled_documents').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    const auditDetail = status === 'Approved' ? `${status} — Issue: ${updates.issue_date}, Review: ${updates.review_date}` : status;
    await auditLog(req.params.id, 'StatusChanged', req.user.id, old.status, auditDetail);
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/controlled-documents/:id/download — signed URL with audience check
router.get('/:id/download', authenticate, async (req, res, next) => {
  try {
    const { data: doc } = await supabase.from('controlled_documents').select('storage_path, audience, status').eq('id', req.params.id).eq('company_id', req.user.company_id).single();
    if (!doc || !doc.storage_path) return res.status(404).json({ error: 'Document or file not found' });

    // Audience enforcement
    if (doc.audience === 'Internal' && !['SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorised to view this document' });
    }

    const { data: signed, error } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 300);
    if (error || !signed?.signedUrl) return res.status(404).json({ error: 'File not found in storage' });
    res.json({ url: signed.signedUrl });
  } catch (err) { next(err); }
});

// POST /api/controlled-documents/:id/acknowledge — officer acks current revision
router.post('/:id/acknowledge', authenticate, async (req, res, next) => {
  try {
    const { data: doc } = await supabase.from('controlled_documents').select('id, doc_number, revision, audience, status').eq('id', req.params.id).eq('company_id', req.user.company_id).single();
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.status !== 'Approved') return res.status(400).json({ error: 'Can only acknowledge Approved documents' });

    const { data, error } = await supabase.from('controlled_document_acknowledgements').insert({
      document_id: doc.id, user_id: req.user.id, doc_number: doc.doc_number, revision: doc.revision,
      ip_address: req.headers['x-forwarded-for'] || req.ip,
    }).select().single();
    if (error) { if (error.code === '23505') return res.json({ data: { already: true } }); throw error; }
    await auditLog(doc.id, 'Acknowledged', req.user.id, null, `${req.user.first_name} ${req.user.last_name}`);
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// GET /api/controlled-documents/:id/acknowledgements — who has/hasn't acked
router.get('/:id/acknowledgements', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { data: doc } = await supabase.from('controlled_documents').select('audience').eq('id', req.params.id).eq('company_id', req.user.company_id).single();
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Get all officers in the company
    const { data: officers } = await supabase.from('users').select('id, first_name, last_name').eq('company_id', req.user.company_id).eq('role', 'OFFICER').eq('active', true);

    // Get acks for this doc
    const { data: acks } = await supabase.from('controlled_document_acknowledgements').select('user_id, acknowledged_at').eq('document_id', req.params.id);
    const ackMap = {};
    (acks || []).forEach(a => { ackMap[a.user_id] = a.acknowledged_at; });

    const result = (officers || []).map(o => ({ ...o, acknowledged: !!ackMap[o.id], acknowledged_at: ackMap[o.id] || null }));
    res.json({ data: result, total: result.length, acknowledged: result.filter(r => r.acknowledged).length });
  } catch (err) { next(err); }
});

module.exports = router;
