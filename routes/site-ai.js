const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// ── Must be registered BEFORE /:siteId to avoid Express param conflict ──

// GET /api/site-ai/officer/:userId/compliance — AI declaration status for Training & Compliance tab
router.get('/officer/:userId/compliance', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const userId = req.params.userId;

    // Sites this officer is assigned to
    const { data: assignments } = await supabase
      .from('officer_sites')
      .select('site_id, site:sites!officer_sites_site_id_fkey(id, name)')
      .eq('officer_id', userId);

    if (!assignments || assignments.length === 0) return res.json({ sites: [] });

    const siteIds = assignments.map(a => a.site_id);

    // Published AIs for those sites
    const { data: ais } = await supabase
      .from('site_assignment_instructions')
      .select('id, site_id, revision, title, published_at')
      .eq('company_id', req.user.company_id)
      .eq('status', 'published')
      .in('site_id', siteIds);

    if (!ais || ais.length === 0) return res.json({ sites: [] });

    // Officer's declarations
    const aiIds = ais.map(a => a.id);
    const { data: decls } = await supabase
      .from('site_ai_declarations')
      .select('ai_id, revision, declared_at')
      .eq('user_id', userId)
      .in('ai_id', aiIds);

    const declMap = {};
    (decls || []).forEach(d => { declMap[`${d.ai_id}_${d.revision}`] = d.declared_at; });

    const siteMap = {};
    assignments.forEach(a => { siteMap[a.site_id] = a.site?.name || 'Unknown'; });

    const sites = ais.map(ai => ({
      site_id: ai.site_id,
      site_name: siteMap[ai.site_id],
      ai_id: ai.id,
      revision: ai.revision,
      title: ai.title,
      published_at: ai.published_at,
      declared: !!declMap[`${ai.id}_${ai.revision}`],
      declared_at: declMap[`${ai.id}_${ai.revision}`] || null,
    }));

    res.json({ sites });
  } catch (err) { next(err); }
});

// ── Site-scoped routes ──────────────────────────────────────────────────────

// GET /api/site-ai/:siteId — get current AI for a site
router.get('/:siteId', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('site_assignment_instructions')
      .select('*')
      .eq('site_id', req.params.siteId)
      .eq('company_id', req.user.company_id)
      .maybeSingle();
    if (error) throw error;
    res.json({ data: data || null });
  } catch (err) { next(err); }
});

// GET /api/site-ai/:siteId/published — latest published revision (for officers)
router.get('/:siteId/published', authenticate, async (req, res, next) => {
  try {
    const { data: ai } = await supabase
      .from('site_assignment_instructions')
      .select('*')
      .eq('site_id', req.params.siteId)
      .eq('company_id', req.user.company_id)
      .eq('status', 'published')
      .maybeSingle();
    if (!ai) return res.json({ data: null });

    // Check if this officer has declared on the current revision
    const { data: decl } = await supabase
      .from('site_ai_declarations')
      .select('id, declared_at')
      .eq('ai_id', ai.id)
      .eq('user_id', req.user.id)
      .eq('revision', ai.revision)
      .maybeSingle();

    res.json({ data: { ...ai, declared: !!decl, declared_at: decl?.declared_at || null } });
  } catch (err) { next(err); }
});

// PUT /api/site-ai/:siteId — create or update draft
router.put('/:siteId', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { title, sections, linked_policies } = req.body;
    const siteId = req.params.siteId;

    // Check if AI already exists for this site
    const { data: existing } = await supabase
      .from('site_assignment_instructions')
      .select('id, revision, status')
      .eq('site_id', siteId)
      .eq('company_id', req.user.company_id)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('site_assignment_instructions')
        .update({
          title: title || 'Assignment Instructions',
          sections: sections || [],
          linked_policies: linked_policies || [],
          updated_by: req.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      res.json({ data });
    } else {
      const { data, error } = await supabase
        .from('site_assignment_instructions')
        .insert({
          company_id: req.user.company_id,
          site_id: siteId,
          title: title || 'Assignment Instructions',
          sections: sections || [],
          linked_policies: linked_policies || [],
          revision: 0,
          status: 'draft',
          updated_by: req.user.id,
        })
        .select()
        .single();
      if (error) throw error;
      res.json({ data });
    }
  } catch (err) { next(err); }
});

// POST /api/site-ai/:siteId/publish — snapshot current content as new revision
router.post('/:siteId/publish', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { data: ai, error: fetchErr } = await supabase
      .from('site_assignment_instructions')
      .select('*')
      .eq('site_id', req.params.siteId)
      .eq('company_id', req.user.company_id)
      .single();
    if (fetchErr || !ai) return res.status(404).json({ error: 'No assignment instructions found for this site' });

    const newRevision = (ai.revision || 0) + 1;
    const now = new Date().toISOString();

    // Snapshot into revisions table
    const { error: revErr } = await supabase
      .from('site_ai_revisions')
      .insert({
        ai_id: ai.id,
        site_id: ai.site_id,
        company_id: ai.company_id,
        revision: newRevision,
        title: ai.title,
        sections: ai.sections,
        linked_policies: ai.linked_policies || [],
        published_by: req.user.id,
        published_at: now,
      });
    if (revErr) throw revErr;

    // Update main record
    const { data, error: upErr } = await supabase
      .from('site_assignment_instructions')
      .update({
        revision: newRevision,
        status: 'published',
        published_by: req.user.id,
        published_at: now,
        updated_by: req.user.id,
        updated_at: now,
      })
      .eq('id', ai.id)
      .select()
      .single();
    if (upErr) throw upErr;

    res.json({ data, revision: newRevision });
  } catch (err) { next(err); }
});

// GET /api/site-ai/:siteId/revisions — revision history
router.get('/:siteId/revisions', authenticate, async (req, res, next) => {
  try {
    const { data: ai } = await supabase
      .from('site_assignment_instructions')
      .select('id')
      .eq('site_id', req.params.siteId)
      .eq('company_id', req.user.company_id)
      .maybeSingle();
    if (!ai) return res.json({ data: [] });

    const { data, error } = await supabase
      .from('site_ai_revisions')
      .select('id, revision, title, published_at, published_by, publisher:users!site_ai_revisions_published_by_fkey(first_name, last_name)')
      .eq('ai_id', ai.id)
      .order('revision', { ascending: false });
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (err) { next(err); }
});

// GET /api/site-ai/:siteId/revisions/:rev — get specific revision content
router.get('/:siteId/revisions/:rev', authenticate, async (req, res, next) => {
  try {
    const { data: ai } = await supabase
      .from('site_assignment_instructions')
      .select('id')
      .eq('site_id', req.params.siteId)
      .eq('company_id', req.user.company_id)
      .maybeSingle();
    if (!ai) return res.status(404).json({ error: 'Not found' });

    const { data, error } = await supabase
      .from('site_ai_revisions')
      .select('*')
      .eq('ai_id', ai.id)
      .eq('revision', parseInt(req.params.rev))
      .single();
    if (error) return res.status(404).json({ error: 'Revision not found' });
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/site-ai/:siteId/declare — officer declaration
router.post('/:siteId/declare', authenticate, async (req, res, next) => {
  try {
    const { data: ai } = await supabase
      .from('site_assignment_instructions')
      .select('id, revision')
      .eq('site_id', req.params.siteId)
      .eq('company_id', req.user.company_id)
      .eq('status', 'published')
      .maybeSingle();
    if (!ai) return res.status(404).json({ error: 'No published assignment instructions for this site' });

    const { data, error } = await supabase
      .from('site_ai_declarations')
      .insert({
        ai_id: ai.id,
        site_id: req.params.siteId,
        user_id: req.user.id,
        revision: ai.revision,
        ip_address: req.headers['x-forwarded-for'] || req.ip,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.json({ data: { already: true } });
      throw error;
    }
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/site-ai/:siteId/declarations — who has declared on current revision
router.get('/:siteId/declarations', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { data: ai } = await supabase
      .from('site_assignment_instructions')
      .select('id, revision')
      .eq('site_id', req.params.siteId)
      .eq('company_id', req.user.company_id)
      .maybeSingle();
    if (!ai) return res.json({ data: [], revision: 0 });

    // Officers assigned to this site
    const { data: assigned } = await supabase
      .from('officer_sites')
      .select('officer:users!officer_sites_officer_id_fkey(id, first_name, last_name)')
      .eq('site_id', req.params.siteId);

    // Declarations for current revision
    const { data: decls } = await supabase
      .from('site_ai_declarations')
      .select('user_id, declared_at')
      .eq('ai_id', ai.id)
      .eq('revision', ai.revision);

    const declMap = {};
    (decls || []).forEach(d => { declMap[d.user_id] = d.declared_at; });

    const officers = (assigned || []).map(a => ({
      ...a.officer,
      declared: !!declMap[a.officer.id],
      declared_at: declMap[a.officer.id] || null,
    }));

    res.json({ data: officers, revision: ai.revision });
  } catch (err) { next(err); }
});

// POST /api/site-ai/:siteId/pdf — generate printable PDF
router.post('/:siteId/pdf', authenticate, async (req, res, next) => {
  try {
    const PDFDocument = require('pdfkit');
    const { revision: requestedRev } = req.body;

    // Get AI
    const { data: ai } = await supabase
      .from('site_assignment_instructions')
      .select('*')
      .eq('site_id', req.params.siteId)
      .eq('company_id', req.user.company_id)
      .single();
    if (!ai) return res.status(404).json({ error: 'No assignment instructions found' });

    // If a specific revision requested, get from history
    let content = ai;
    if (requestedRev && requestedRev !== ai.revision) {
      const { data: rev } = await supabase
        .from('site_ai_revisions')
        .select('*')
        .eq('ai_id', ai.id)
        .eq('revision', requestedRev)
        .single();
      if (rev) content = rev;
    }

    // Get site name
    const { data: site } = await supabase.from('sites').select('name').eq('id', req.params.siteId).single();
    const siteName = site?.name || 'Unknown Site';

    // Get company name
    const { data: company } = await supabase.from('companies').select('name').eq('id', req.user.company_id).single();
    const companyName = company?.name || 'Risk Secured Ltd';

    const sections = content.sections || [];
    const revision = content.revision || ai.revision;
    const publishedAt = content.published_at ? new Date(content.published_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Draft';

    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = 595, M = 40, CW = W - M * 2;

      // Header band
      doc.rect(0, 0, W, 70).fill('#0b1a3e');
      doc.rect(0, 70, W, 3).fill('#1a52a8');
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#ffffff').text(companyName, M, 16, { width: CW * 0.6 });
      doc.fontSize(9).font('Helvetica').fillColor('#93c5fd').text('Intelligence Led Security', M, 36, { width: CW * 0.6 });
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#93c5fd').text('ASSIGNMENT INSTRUCTIONS', M + CW * 0.5, 18, { width: CW * 0.5, align: 'right' });
      doc.fontSize(8).font('Helvetica').fillColor('rgba(255,255,255,0.5)').text('CONFIDENTIAL — FOR OPERATIONAL USE ONLY', M + CW * 0.5, 36, { width: CW * 0.5, align: 'right' });

      let y = 85;

      // Site / revision bar
      doc.rect(M, y, CW, 28).fill('#f8fafc');
      doc.rect(M, y, CW, 28).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text(siteName, M + 10, y + 9);
      doc.fontSize(8).font('Helvetica').fillColor('#6b7280').text(`Revision ${revision} — ${publishedAt}`, M + CW - 200, y + 9, { width: 190, align: 'right' });
      y += 40;

      // Title
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#0f172a').text(content.title || 'Assignment Instructions', M, y, { width: CW });
      y += doc.heightOfString(content.title || 'Assignment Instructions', { width: CW, fontSize: 14 }) + 8;
      doc.rect(M, y, CW, 2).fill('#1a52a8');
      y += 14;

      // Sections
      sections.forEach((sec, idx) => {
        // Check if we need a new page
        if (y > 720) { doc.addPage(); y = 40; }

        // Section number + title
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a52a8')
          .text(`${idx + 1}. ${sec.title || 'Untitled Section'}`, M, y, { width: CW });
        y += doc.heightOfString(`${idx + 1}. ${sec.title || 'Untitled Section'}`, { width: CW, fontSize: 11 }) + 6;

        // Section content
        const content_text = sec.content || '';
        if (content_text) {
          doc.fontSize(9.5).font('Helvetica').fillColor('#0f172a');
          // Split by lines to handle page breaks within content
          const lines = content_text.split('\n');
          lines.forEach(line => {
            if (y > 740) { doc.addPage(); y = 40; }
            if (line.trim() === '') {
              y += 8;
            } else {
              doc.text(line, M, y, { width: CW, lineGap: 3 });
              y += doc.heightOfString(line, { width: CW, fontSize: 9.5, lineGap: 3 }) + 2;
            }
          });
        }

        y += 12; // gap between sections
      });

      // Linked policies
      if (content.linked_policies && content.linked_policies.length > 0) {
        if (y > 700) { doc.addPage(); y = 40; }
        doc.rect(M, y, CW, 0.5).fill('#e2e8f0'); y += 10;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#6b7280').text('LINKED POLICIES', M, y); y += 14;
        content.linked_policies.forEach(p => {
          doc.fontSize(9).font('Helvetica').fillColor('#0f172a').text(`• ${p}`, M + 10, y, { width: CW - 10 }); y += 14;
        });
        y += 8;
      }

      // Declaration notice
      if (y > 700) { doc.addPage(); y = 40; }
      doc.rect(M, y, CW, 0.5).fill('#e2e8f0'); y += 10;
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#6b7280').text('DECLARATION', M, y); y += 12;
      doc.fontSize(7.5).font('Helvetica').fillColor('#334155')
        .text(`All officers assigned to ${siteName} must read, understand and comply with these Assignment Instructions. By signing on duty, you confirm that you have read Revision ${revision} and will comply with all instructions herein.`, M, y, { width: CW, lineGap: 2 });
      y += 40;

      // Confidentiality notice
      if (y > 740) { doc.addPage(); y = 40; }
      doc.fontSize(7).font('Helvetica').fillColor('#9ca3af')
        .text('This document is the property of ' + companyName + ' and is confidential. It must not be reproduced or disclosed to any third party without written authorisation.', M, y, { width: CW, lineGap: 2 });

      // Footer on all pages
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        const fY = doc.page.height - 40;
        doc.rect(0, fY, W, 0.5).fill('#e2e8f0');
        doc.fontSize(7).fillColor('#9ca3af').font('Helvetica')
          .text(`${companyName} · Intelligence Led Security · Revision ${revision} · ${publishedAt} · Page ${i + 1} of ${pageCount}`, M, fY + 8, { width: CW, align: 'center' });
      }

      doc.end();
    });

    const filename = `AI-${siteName.replace(/[^a-zA-Z0-9]/g, '-')}-Rev${revision}.pdf`;
    res.json({ pdf: pdfBuffer.toString('base64'), filename });
  } catch (err) { next(err); }
});

module.exports = router;
