const router = require('express').Router();
const multer = require('multer');
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const MANAGER = ['SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'];

// GET / — list all subcontractors for company
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { data: subs, error } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('company_id', req.user.company_id)
      .order('company_name');
    if (error) throw error;

    // Attach sites for each
    const ids = (subs || []).map(s => s.id);
    let sitesMap = {};
    if (ids.length > 0) {
      const { data: links } = await supabase
        .from('subcontractor_sites')
        .select('subcontractor_id, site:sites!subcontractor_sites_site_id_fkey(id, name)')
        .in('subcontractor_id', ids);
      (links || []).forEach(l => {
        if (!sitesMap[l.subcontractor_id]) sitesMap[l.subcontractor_id] = [];
        sitesMap[l.subcontractor_id].push(l.site);
      });
    }

    // Doc counts
    let docCounts = {};
    if (ids.length > 0) {
      const { data: docs } = await supabase
        .from('subcontractor_documents')
        .select('subcontractor_id')
        .in('subcontractor_id', ids);
      (docs || []).forEach(d => { docCounts[d.subcontractor_id] = (docCounts[d.subcontractor_id] || 0) + 1; });
    }

    res.json({ data: (subs || []).map(s => ({ ...s, sites: sitesMap[s.id] || [], doc_count: docCounts[s.id] || 0 })) });
  } catch (err) { next(err); }
});

// GET /:id — single subcontractor with sites + documents
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data: sub, error } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .single();
    if (error) return res.status(404).json({ error: 'Not found' });

    const [sitesRes, docsRes] = await Promise.all([
      supabase.from('subcontractor_sites')
        .select('site:sites!subcontractor_sites_site_id_fkey(id, name)')
        .eq('subcontractor_id', sub.id),
      supabase.from('subcontractor_documents')
        .select('id, name, original_name, storage_path, mime_type, file_size, doc_type, share_to_portal, site_id, site:sites!subcontractor_documents_site_id_fkey(id, name), created_at')
        .eq('subcontractor_id', sub.id)
        .order('created_at', { ascending: false }),
    ]);

    res.json({
      data: {
        ...sub,
        sites: (sitesRes.data || []).map(r => r.site),
        documents: docsRes.data || [],
      }
    });
  } catch (err) { next(err); }
});

// POST / — create subcontractor
router.post('/', authenticate, requireRole(...MANAGER), async (req, res, next) => {
  try {
    const { company_name, service_type, primary_name, primary_phone, primary_email, secondary_name, secondary_phone, secondary_email, backup_name, backup_phone, backup_email, out_of_hours_phone, address, account_number, notes, site_ids } = req.body;
    if (!company_name?.trim()) return res.status(400).json({ error: 'Company name required' });

    const { data, error } = await supabase
      .from('subcontractors')
      .insert({
        company_id: req.user.company_id, company_name: company_name.trim(),
        service_type: service_type || 'Other',
        primary_name, primary_phone, primary_email,
        secondary_name, secondary_phone, secondary_email,
        backup_name, backup_phone, backup_email,
        out_of_hours_phone, address, account_number, notes,
        created_by: req.user.id,
      })
      .select().single();
    if (error) throw error;

    // Assign sites
    if (site_ids && site_ids.length > 0) {
      await supabase.from('subcontractor_sites').insert(site_ids.map(sid => ({ subcontractor_id: data.id, site_id: sid })));
    }

    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PATCH /:id — update subcontractor
router.patch('/:id', authenticate, requireRole(...MANAGER), async (req, res, next) => {
  try {
    const { company_name, service_type, primary_name, primary_phone, primary_email, secondary_name, secondary_phone, secondary_email, backup_name, backup_phone, backup_email, out_of_hours_phone, address, account_number, notes } = req.body;
    const updates = {};
    if (company_name !== undefined) updates.company_name = company_name;
    if (service_type !== undefined) updates.service_type = service_type;
    if (primary_name !== undefined) updates.primary_name = primary_name;
    if (primary_phone !== undefined) updates.primary_phone = primary_phone;
    if (primary_email !== undefined) updates.primary_email = primary_email;
    if (secondary_name !== undefined) updates.secondary_name = secondary_name;
    if (secondary_phone !== undefined) updates.secondary_phone = secondary_phone;
    if (secondary_email !== undefined) updates.secondary_email = secondary_email;
    if (backup_name !== undefined) updates.backup_name = backup_name;
    if (backup_phone !== undefined) updates.backup_phone = backup_phone;
    if (backup_email !== undefined) updates.backup_email = backup_email;
    if (out_of_hours_phone !== undefined) updates.out_of_hours_phone = out_of_hours_phone;
    if (address !== undefined) updates.address = address;
    if (account_number !== undefined) updates.account_number = account_number;
    if (notes !== undefined) updates.notes = notes;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('subcontractors')
      .update(updates)
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// DELETE /:id — delete subcontractor (cascades)
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'FD'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('subcontractors')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PUT /:id/sites — replace site assignments
router.put('/:id/sites', authenticate, requireRole(...MANAGER), async (req, res, next) => {
  try {
    const { site_ids } = req.body;
    await supabase.from('subcontractor_sites').delete().eq('subcontractor_id', req.params.id);
    if (site_ids && site_ids.length > 0) {
      const { error } = await supabase.from('subcontractor_sites').insert(site_ids.map(sid => ({ subcontractor_id: req.params.id, site_id: sid })));
      if (error) throw error;
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:id/documents — upload document
router.post('/:id/documents', authenticate, requireRole(...MANAGER), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File required' });
    const { site_id, doc_type, share_to_portal } = req.body;
    if (!site_id) return res.status(400).json({ error: 'site_id required' });

    const filename = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const path = `subcontractors/${req.user.company_id}/${req.params.id}/${filename}`;

    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (uploadErr) throw uploadErr;

    const { data, error } = await supabase
      .from('subcontractor_documents')
      .insert({
        subcontractor_id: req.params.id,
        company_id: req.user.company_id,
        site_id,
        name: req.file.originalname,
        original_name: req.file.originalname,
        storage_path: path,
        mime_type: req.file.mimetype,
        file_size: req.file.size,
        doc_type: doc_type || null,
        share_to_portal: share_to_portal === 'true' || share_to_portal === true,
        uploaded_by: req.user.id,
      })
      .select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PATCH /:id/documents/:docId — toggle share / update doc_type
router.patch('/:id/documents/:docId', authenticate, requireRole(...MANAGER), async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.share_to_portal !== undefined) updates.share_to_portal = req.body.share_to_portal;
    if (req.body.doc_type !== undefined) updates.doc_type = req.body.doc_type;
    const { data, error } = await supabase
      .from('subcontractor_documents')
      .update(updates)
      .eq('id', req.params.docId)
      .eq('subcontractor_id', req.params.id)
      .eq('company_id', req.user.company_id)
      .select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// DELETE /:id/documents/:docId — delete document
router.delete('/:id/documents/:docId', authenticate, requireRole(...MANAGER), async (req, res, next) => {
  try {
    const { data: doc } = await supabase.from('subcontractor_documents').select('storage_path').eq('id', req.params.docId).eq('company_id', req.user.company_id).single();
    if (doc?.storage_path) await supabase.storage.from('documents').remove([doc.storage_path]);
    const { error } = await supabase.from('subcontractor_documents').delete().eq('id', req.params.docId).eq('company_id', req.user.company_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /:id/documents/:docId/signed — signed URL
router.get('/:id/documents/:docId/signed', authenticate, async (req, res, next) => {
  try {
    const { data: doc } = await supabase.from('subcontractor_documents').select('storage_path').eq('id', req.params.docId).eq('company_id', req.user.company_id).single();
    if (!doc?.storage_path) return res.status(404).json({ error: 'Not found' });
    if (doc.storage_path.startsWith('http://') || doc.storage_path.startsWith('https://') || doc.storage_path.startsWith('data:')) {
      return res.json({ data: { url: doc.storage_path } });
    }
    const { data: s, error } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 300);
    if (error || !s?.signedUrl) return res.status(404).json({ error: 'File not found in storage' });
    res.json({ data: { url: s.signedUrl } });
  } catch (err) { next(err); }
});

module.exports = router;
