const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/risk-assessments?site_id=xxx
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { site_id } = req.query;
    let query = supabase
      .from('risk_assessments')
      .select('*, assessor:users!risk_assessments_assessor_id_fkey(id, first_name, last_name), site:sites(id, name)')
      .eq('company_id', req.user.company_id)
      .order('assessment_date', { ascending: false });
    if (site_id) query = query.eq('site_id', site_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/risk-assessments/categories?type=security
router.get('/categories', authenticate, async (req, res, next) => {
  try {
    const { type } = req.query;
    let query = supabase.from('risk_categories').select('*').order('sort_order');
    if (type) query = query.eq('assessment_type', type);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/risk-assessments/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('risk_assessments')
      .select('*, assessor:users!risk_assessments_assessor_id_fkey(id, first_name, last_name), site:sites(id, name)')
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Assessment not found' });

    // Load risks for this assessment
    const { data: risks } = await supabase
      .from('risks')
      .select('*, category:risk_categories(id, name)')
      .eq('risk_assessment_id', req.params.id)
      .order('created_at');

    res.json({ data: { ...data, risks: risks || [] } });
  } catch (err) { next(err); }
});

// POST /api/risk-assessments
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { site_id, assessment_type, title, scope, description, methodology, assessment_date, review_date } = req.body;
    if (!site_id || !title || !scope) return res.status(400).json({ error: 'site_id, title, and scope required' });

    // Generate reference number
    const { count } = await supabase.from('risk_assessments').select('*', { count: 'exact', head: true }).eq('company_id', req.user.company_id);
    const refNum = `RA-${String((count || 0) + 1).padStart(4, '0')}`;

    const { data, error } = await supabase
      .from('risk_assessments')
      .insert({
        company_id: req.user.company_id,
        site_id,
        assessment_type: assessment_type || 'security',
        title,
        scope,
        description: description || null,
        methodology: methodology || null,
        reference_number: refNum,
        assessment_date: assessment_date || new Date().toISOString().split('T')[0],
        review_date: review_date || new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        assessor_id: req.user.id,
        created_by: req.user.id,
        status: 'draft',
      })
      .select()
      .single();
    if (error) {
      console.error('[RiskAssessment] Create failed:', error.message, error.details, error.hint);
      throw error;
    }
    console.log('[RiskAssessment] Created:', data.id, data.reference_number);
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PATCH /api/risk-assessments/:id
router.patch('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const allowed = ['title', 'scope', 'description', 'methodology', 'assessment_type', 'status', 'overall_risk_level', 'residual_risk_level', 'review_date', 'approved_date', 'approver_id'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    updates.updated_by = req.user.id;
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('risk_assessments')
      .update(updates)
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .select()
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/risk-assessments/:id/risks — add a risk to an assessment
router.post('/:id/risks', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { risk_category_id, hazard_description, who_at_risk, potential_consequences, existing_controls, likelihood_score, severity_score, additional_controls, residual_likelihood, residual_severity } = req.body;
    if (!hazard_description) return res.status(400).json({ error: 'hazard_description required' });

    const lk = likelihood_score || 1;
    const sv = severity_score || 1;
    const score = lk * sv;
    const level = score >= 20 ? 'very_high' : score >= 12 ? 'high' : score >= 6 ? 'medium' : 'low';
    const rlk = residual_likelihood || lk;
    const rsv = residual_severity || sv;
    const rScore = rlk * rsv;
    const rLevel = rScore >= 20 ? 'very_high' : rScore >= 12 ? 'high' : rScore >= 6 ? 'medium' : 'low';

    const { data, error } = await supabase
      .from('risks')
      .insert({
        risk_assessment_id: req.params.id,
        risk_category_id: risk_category_id || null,
        hazard_description,
        who_at_risk: who_at_risk || 'Security personnel, staff, visitors',
        potential_consequences: potential_consequences || 'Injury, financial loss, operational disruption',
        existing_controls: existing_controls || null,
        likelihood_score: lk,
        severity_score: sv,
        risk_level: level,
        additional_controls: additional_controls || null,
        residual_likelihood: rlk,
        residual_severity: rsv,
        residual_level: rLevel,
      })
      .select('*, category:risk_categories(id, name)')
      .single();
    if (error) {
      console.error('[Risk] Insert failed:', error.message, error.details, error.hint);
      throw error;
    }
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// DELETE /api/risk-assessments/:id/risks/:riskId
router.delete('/:id/risks/:riskId', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { error } = await supabase.from('risks').delete().eq('id', req.params.riskId).eq('risk_assessment_id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/risk-assessments/:id/pdf
router.get('/:id/pdf', authenticate, async (req, res, next) => {
  try {
    const PDFDocument = require('pdfkit');
    const { data: ra, error } = await supabase
      .from('risk_assessments')
      .select('*, assessor:users!risk_assessments_assessor_id_fkey(first_name, last_name), site:sites(name, address)')
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .single();
    if (error || !ra) return res.status(404).json({ error: 'Assessment not found' });

    const { data: risks } = await supabase
      .from('risks')
      .select('*, category:risk_categories(name)')
      .eq('risk_assessment_id', req.params.id)
      .order('created_at');

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Risk-Assessment-${ra.reference_number}.pdf"`);
    doc.pipe(res);

    const W = 595, M = 40, CW = W - M * 2;
    const levelColor = { low: '#16a34a', medium: '#f59e0b', high: '#ef4444', very_high: '#991b1b' };

    // Header bar
    doc.rect(0, 0, W, 4).fill('#1a52a8');
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#0b1a3e').text('RISK ASSESSMENT', M, 20);
    doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
      .text(`Ref: ${ra.reference_number}`, M, 44)
      .text(`Date: ${new Date(ra.assessment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`, M, 56)
      .text(`Review: ${new Date(ra.review_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`, M, 68);

    // Type + Status
    const typeLabel = (ra.assessment_type || '').replace('_', ' ').toUpperCase();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#1a52a8')
      .text(`${typeLabel} ASSESSMENT`, W - M - 200, 20, { width: 200, align: 'right' });
    doc.fontSize(8).font('Helvetica').fillColor('#6b7280')
      .text(`Status: ${(ra.status || 'draft').toUpperCase()}`, W - M - 200, 34, { width: 200, align: 'right' });
    if (ra.assessor) doc.text(`Assessor: ${ra.assessor.first_name} ${ra.assessor.last_name}`, W - M - 200, 46, { width: 200, align: 'right' });

    let y = 85;
    doc.rect(M, y, CW, 0.5).fill('#e2e8f0'); y += 10;

    // Site + Title
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text(ra.title, M, y, { width: CW }); y += 18;
    doc.fontSize(9).font('Helvetica').fillColor('#374151').text(`Site: ${ra.site?.name || '—'}`, M, y); y += 14;

    // Scope
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#6b7280').text('SCOPE', M, y); y += 12;
    doc.fontSize(8).font('Helvetica').fillColor('#374151').text(ra.scope || '—', M, y, { width: CW }); y += doc.heightOfString(ra.scope || '—', { width: CW }) + 10;

    if (ra.methodology) {
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#6b7280').text('METHODOLOGY', M, y); y += 12;
      doc.fontSize(8).font('Helvetica').fillColor('#374151').text(ra.methodology, M, y, { width: CW }); y += doc.heightOfString(ra.methodology, { width: CW }) + 10;
    }

    doc.rect(M, y, CW, 0.5).fill('#e2e8f0'); y += 12;

    // Risk table
    if (risks && risks.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0b1a3e').text('IDENTIFIED RISKS', M, y); y += 18;

      for (const risk of risks) {
        if (y > 680) { doc.addPage(); y = 40; }

        // Risk header
        const col = levelColor[risk.risk_level] || '#6b7280';
        doc.rect(M, y, CW, 18).fill(col + '15');
        doc.rect(M, y, 3, 18).fill(col);
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#111827')
          .text(risk.category?.name || 'General', M + 10, y + 4, { width: CW - 120 });
        doc.fontSize(7).font('Helvetica-Bold').fillColor(col)
          .text(`${(risk.risk_level || '').replace('_', ' ').toUpperCase()} (${risk.risk_score || 0})`, M + CW - 100, y + 4, { width: 90, align: 'right' });
        y += 22;

        // Hazard
        doc.fontSize(7.5).font('Helvetica').fillColor('#374151');
        doc.font('Helvetica-Bold').text('Hazard: ', M, y, { continued: true }).font('Helvetica').text(risk.hazard_description || '—');
        y += doc.heightOfString(risk.hazard_description || '—', { width: CW }) + 4;

        if (risk.who_at_risk) { doc.font('Helvetica-Bold').text('Who at risk: ', M, y, { continued: true }).font('Helvetica').text(risk.who_at_risk); y += 12; }
        if (risk.existing_controls) { doc.font('Helvetica-Bold').text('Existing controls: ', M, y, { continued: true }).font('Helvetica').text(risk.existing_controls, { width: CW - 10 }); y += doc.heightOfString(risk.existing_controls, { width: CW - 10 }) + 4; }
        if (risk.additional_controls) { doc.font('Helvetica-Bold').text('Additional controls: ', M, y, { continued: true }).font('Helvetica').text(risk.additional_controls, { width: CW - 10 }); y += doc.heightOfString(risk.additional_controls, { width: CW - 10 }) + 4; }

        // Residual risk
        if (risk.residual_level && risk.residual_level !== risk.risk_level) {
          const rCol = levelColor[risk.residual_level] || '#6b7280';
          doc.fontSize(7).font('Helvetica-Bold').fillColor(rCol)
            .text(`Residual risk: ${risk.residual_level.replace('_', ' ').toUpperCase()} (${risk.residual_score})`, M, y);
          y += 12;
        }
        y += 8;
      }
    } else {
      doc.fontSize(9).font('Helvetica').fillColor('#9ca3af').text('No risks have been identified yet.', M, y);
      y += 16;
    }

    // Footer
    y += 10;
    doc.rect(M, y, CW, 0.5).fill('#e2e8f0'); y += 10;
    doc.fontSize(7).font('Helvetica').fillColor('#9ca3af')
      .text(`Generated by DOB Live on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}. This document is confidential.`, M, y, { width: CW });

    doc.end();
  } catch (err) { next(err); }
});

module.exports = router;
