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

// POST /api/hr/invoice — generate PDF invoice and email to accounts
router.post('/invoice', authenticate, async (req, res, next) => {
  try {
    const PDFDocument = require('pdfkit');
    const { invoiceRef, month, shifts, contractor, totals } = req.body;
    if (!shifts?.length) return res.status(400).json({ error: 'No shifts provided' });

    const officer = req.user;
    const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

    // Generate PDF
    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = 595, M = 40, CW = W - M * 2;

      // Header
      doc.rect(0, 0, W, 3).fill('#1a52a8');
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#0b1a3e').text('INVOICE', M, 20);
      doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
        .text(`Ref: ${invoiceRef}`, M, 46)
        .text(`Date: ${today}`, M, 58)
        .text(`Period: ${month}`, M, 70);

      // From (right side)
      const fromX = W - M - 200;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0b1a3e')
        .text(contractor.name || `${officer.first_name} ${officer.last_name}`, fromX, 20, { width: 200, align: 'right' });
      let fy = 36;
      doc.fontSize(8).font('Helvetica').fillColor('#6b7280');
      if (contractor.address) { doc.text(contractor.address, fromX, fy, { width: 200, align: 'right' }); fy += 12; }
      if (contractor.company_reg) { doc.text(`Company No: ${contractor.company_reg}`, fromX, fy, { width: 200, align: 'right' }); fy += 12; }
      if (contractor.vat) { doc.text(`VAT: ${contractor.vat}`, fromX, fy, { width: 200, align: 'right' }); fy += 12; }
      if (contractor.utr) { doc.text(`UTR: ${contractor.utr}`, fromX, fy, { width: 200, align: 'right' }); fy += 12; }

      let y = 90;
      doc.rect(M, y, CW, 0.5).fill('#e2e8f0'); y += 8;

      // Contractor & Bill To
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#6b7280').text('CONTRACTOR DETAILS', M, y);
      doc.text('BILL TO', M + CW / 2, y); y += 14;
      doc.fontSize(8).font('Helvetica').fillColor('#374151');
      doc.text(`SIA Licence: ${contractor.sia_number || '—'}`, M, y);
      doc.text('Risk Secured Ltd', M + CW / 2, y); y += 12;
      doc.text(`SIA Type: ${contractor.sia_type || '—'}`, M, y);
      doc.text('Security Services', M + CW / 2, y); y += 12;
      doc.text(`SIA Expiry: ${contractor.sia_expiry || '—'}`, M, y); y += 12;
      if (contractor.utr) { doc.text(`UTR: ${contractor.utr}`, M, y); y += 12; }
      y += 8;
      doc.rect(M, y, CW, 0.5).fill('#e2e8f0'); y += 12;

      // Table header
      const cols = [M, M+80, M+200, M+310, M+390, M+CW-50];
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#6b7280');
      doc.text('DATE', cols[0], y);
      doc.text('SITE', cols[1], y);
      doc.text('FROM–TO', cols[2], y);
      doc.text('HOURS', cols[3], y, { width: 60, align: 'right' });
      doc.text('RATE', cols[4], y, { width: 50, align: 'right' });
      doc.text('AMOUNT', cols[5], y, { width: 65, align: 'right' });
      y += 16; doc.rect(M, y - 2, CW, 0.5).fill('#e5e7eb');

      // Line items
      doc.fontSize(8).font('Helvetica').fillColor('#111827');
      for (const s of shifts) {
        if (y > 720) { doc.addPage(); y = 40; }
        doc.text(s.date, cols[0], y);
        doc.text(s.site, cols[1], y, { width: 115 });
        doc.text(s.times, cols[2], y);
        doc.text(s.hours, cols[3], y, { width: 60, align: 'right' });
        doc.text(`£${s.rate}`, cols[4], y, { width: 50, align: 'right' });
        doc.font('Helvetica-Bold').text(`£${s.amount}`, cols[5], y, { width: 65, align: 'right' });
        doc.font('Helvetica');
        y += 16;
        doc.rect(M, y - 2, CW, 0.25).fill('#f1f5f9');
      }

      // Totals
      y += 8; doc.rect(M, y, CW, 1.5).fill('#0b1a3e'); y += 10;
      doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
        .text(`Total Hours: ${totals.hours}`, M, y);
      doc.font('Helvetica-Bold').fillColor('#0b1a3e')
        .text(`Subtotal: £${totals.subtotal}`, M + CW - 150, y, { width: 150, align: 'right' });
      y += 16;
      if (totals.vat) {
        doc.fontSize(8).font('Helvetica').fillColor('#6b7280')
          .text(`VAT (20%): £${totals.vat}`, M + CW - 150, y, { width: 150, align: 'right' });
        y += 14;
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0b1a3e')
          .text(`Total: £${totals.total}`, M + CW - 150, y, { width: 150, align: 'right' });
        y += 20;
      }

      // Declaration
      y += 8;
      if (y > 600) { doc.addPage(); y = 40; }
      doc.rect(M, y, CW, 0.5).fill('#e2e8f0'); y += 10;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#92400e').text('Self-Employment Declaration', M, y); y += 14;
      doc.fontSize(7).font('Helvetica').fillColor('#6b7280');
      const decl = `I confirm that I am ${contractor.is_ltd ? 'operating through a limited company' : 'self-employed'} for the purposes of this engagement and that this is not a contract of employment. I am responsible for the payment of my own Income Tax and National Insurance Contributions in accordance with the Income Tax (Earnings and Pensions) Act 2003 and the Social Security Contributions and Benefits Act 1992. I am not entitled to employment rights under the Employment Rights Act 1996. I am responsible for registering with HMRC for Self Assessment and submitting my own tax returns. I hold a valid SIA licence as required under the Private Security Industry Act 2001.`;
      doc.text(decl, M, y, { width: CW, lineGap: 2 });
      y += doc.heightOfString(decl, { width: CW, lineGap: 2 }) + 12;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151')
        .text(`Signed electronically by ${officer.first_name} ${officer.last_name} on ${today}`, M, y);
      y += 20;

      // Payment terms
      doc.rect(M, y, CW, 0.5).fill('#e2e8f0'); y += 10;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151').text('Payment Terms', M, y); y += 14;
      doc.fontSize(7).font('Helvetica').fillColor('#6b7280')
        .text(`Payment due within 30 days of invoice date. Please reference invoice number ${invoiceRef} with payment.`, M, y, { width: CW });

      doc.end();
    });

    // Email via SendGrid
    let emailSent = false;
    if (process.env.SENDGRID_API_KEY) {
      const sg = require('@sendgrid/mail');
      sg.setApiKey(process.env.SENDGRID_API_KEY);
      const fromEmail = process.env.RS_INSPECTION_FROM_EMAIL || 'reports@risksecured.co.uk';
      const toEmail = 'accounts@risksecured.co.uk';
      try {
        await sg.send({
          to: toEmail,
          from: { email: fromEmail, name: 'DOB Live' },
          subject: `Invoice ${invoiceRef} — ${contractor.name || `${officer.first_name} ${officer.last_name}`} — ${month}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:#0b1a3e;padding:20px 24px;border-radius:8px 8px 0 0;border-top:4px solid #1a52a8;">
                <h1 style="color:#fff;margin:0;font-size:18px;">DOB Live — Invoice Submission</h1>
              </div>
              <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;background:#fff;">
                <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
                  <tr><td style="padding:6px 0;font-weight:600;width:120px;">Invoice Ref:</td><td>${invoiceRef}</td></tr>
                  <tr><td style="padding:6px 0;font-weight:600;">Contractor:</td><td>${contractor.name || `${officer.first_name} ${officer.last_name}`}</td></tr>
                  <tr><td style="padding:6px 0;font-weight:600;">Period:</td><td>${month}</td></tr>
                  <tr><td style="padding:6px 0;font-weight:600;">Total Hours:</td><td>${totals.hours}</td></tr>
                  <tr><td style="padding:6px 0;font-weight:600;">Amount:</td><td><strong>£${totals.vat ? totals.total : totals.subtotal}</strong></td></tr>
                </table>
                <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Full invoice attached as PDF.</p>
              </div>
            </div>
          `,
          attachments: [{
            content: pdfBuffer.toString('base64'),
            filename: `Invoice-${invoiceRef}.pdf`,
            type: 'application/pdf', disposition: 'attachment',
          }],
        });
        emailSent = true;
      } catch (emailErr) {
        console.error('[Invoice] Email failed:', emailErr.message);
      }
    }

    res.json({ success: true, emailSent });
  } catch (err) { next(err); }
});

module.exports = router;
