const router = require('express').Router();
const multer = require('multer');
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendEmail } = require('../services/notifications');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/hr — get my HR record (or all if manager with ?all=true)
router.get('/', authenticate, async (req, res, next) => {
  try {
    if (req.query.all && ['SUPER_ADMIN','COMPANY','OPS_MANAGER','FD'].includes(req.user.role)) {
      const { data, error } = await supabase.from('officer_hr').select('user_id, vetting_status, onboarding_completed, gdpr_consent').eq('company_id', req.user.company_id);
      if (error) throw error;
      return res.json({ data: data || [] });
    }
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
      personal_email,
      bank_name, bank_sort_code, bank_account_number, bank_account_holder,
      employment_status, utr_number,
      company_name, company_address, company_vat_number, company_reg_number,
      self_employment_declaration, self_employment_declaration_at,
      terms_accepted, terms_accepted_at,
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
      personal_email: personal_email || null,
      bank_name: bank_name || null,
      bank_sort_code: bank_sort_code || null,
      bank_account_number: bank_account_number || null,
      bank_account_holder: bank_account_holder || null,
      employment_status: employment_status || null,
      utr_number: utr_number || null,
      company_name: company_name || null,
      company_address: company_address || null,
      company_vat_number: company_vat_number || null,
      company_reg_number: company_reg_number || null,
      self_employment_declaration: self_employment_declaration || false,
      self_employment_declaration_at: self_employment_declaration_at || null,
      terms_accepted: terms_accepted || false,
      terms_accepted_at: terms_accepted_at || null,
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
    // invoiceRef is ignored from the client — allocated server-side for real invoices.
    // is_wage_query: true takes the legacy path (email only, no DB record, WQ- prefix).
    const { is_wage_query, month, shifts, contractor, totals, shift_ids, period_start, period_end } = req.body;
    if (!shifts?.length) return res.status(400).json({ error: 'No shifts provided' });

    // Reconciliation guard: server-computed sum of shift amounts must match client-supplied subtotal
    const serverSubtotal = shifts.reduce((sum, s) => sum + (parseFloat(s.amount) || 0) + (parseFloat(s.bh_amount) || 0), 0);
    const clientSubtotal = parseFloat(totals?.subtotal) || 0;
    if (Math.abs(serverSubtotal - clientSubtotal) > 0.01) {
      console.error(`[Invoice] Reconciliation mismatch: server=£${serverSubtotal.toFixed(2)} client=£${clientSubtotal.toFixed(2)}`);
      return res.status(400).json({ error: `Invoice total mismatch: server computed £${serverSubtotal.toFixed(2)} but client submitted £${clientSubtotal.toFixed(2)}. Invoice not generated.` });
    }

    const officer = req.user;
    const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

    // Fetch officer_hr once: used for cc email, contractor snapshot, and employment status
    const { data: hrRec } = await supabase.from('officer_hr')
      .select('personal_email, employment_status, company_name, company_vat_number, utr_number')
      .eq('user_id', officer.id).maybeSingle();
    const ccEmail = hrRec?.personal_email || officer.email || null;

    // Wage query: email-only path, no invoice number, no DB record
    if (is_wage_query) {
      const wqRef = `WQ-${Date.now().toString(36).toUpperCase().slice(-6)}`;
      const pdfBuffer = await buildPdf(PDFDocument, wqRef, month, shifts, contractor, totals, officer, today);
      const fromEmail = process.env.RS_INSPECTION_FROM_EMAIL || 'reports@risksecured.co.uk';
      const toEmail = 'accounts@risksecured.co.uk';
      const emailSent = await sendEmail({
        to: toEmail,
        ...(ccEmail ? { cc: ccEmail } : {}),
        from: { email: fromEmail, name: 'DOB Live' },
        subject: `Wage Query ${wqRef} — ${contractor.name || `${officer.first_name} ${officer.last_name}`} — ${month}`,
        html: buildEmailHtml(wqRef, contractor, officer, month, totals),
        attachments: [{ content: pdfBuffer.toString('base64'), filename: `WageQuery-${wqRef}.pdf`, type: 'application/pdf', disposition: 'attachment' }],
      });
      return res.json({ success: true, emailSent });
    }

    // --- Self-bill invoice path ---

    // 1. Allocate invoice number server-side (atomic, no client input accepted)
    const { data: invoiceRef, error: numErr } = await supabase.rpc('next_invoice_number', { p_company_id: officer.company_id });
    if (numErr) throw numErr;

    // 2. Generate PDF
    const pdfBuffer = await buildPdf(PDFDocument, invoiceRef, month, shifts, contractor, totals, officer, today);

    // 3. Upload PDF to hr-documents storage (log and continue on failure — do not block invoicing)
    let pdfPath = null;
    try {
      const storagePath = `${officer.company_id}/${officer.id}/invoices/${invoiceRef}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('hr-documents')
        .upload(storagePath, pdfBuffer, { contentType: 'application/pdf' });
      if (uploadErr) {
        console.error('[Invoice] PDF storage upload failed:', uploadErr.message);
      } else {
        pdfPath = storagePath;
      }
    } catch (uploadEx) {
      console.error('[Invoice] PDF storage upload exception:', uploadEx.message);
    }

    // 4. Snapshot contractor details from officer_hr and insert DB record BEFORE emailing.
    //    If this insert fails we abort — an unrecorded invoice must not be sent.
    const contractorName = hrRec?.employment_status === 'ltd_company'
      ? (hrRec.company_name || `${officer.first_name} ${officer.last_name}`)
      : `${officer.first_name} ${officer.last_name}`;
    const fromEmail = process.env.RS_INSPECTION_FROM_EMAIL || 'reports@risksecured.co.uk';
    const toEmail = 'accounts@risksecured.co.uk';

    const { error: insertErr } = await supabase.from('self_bill_invoices').insert({
      company_id:              officer.company_id,
      officer_id:              officer.id,
      invoice_number:          invoiceRef,
      period_start:            period_start || null,
      period_end:              period_end   || null,
      total_hours:             parseFloat(totals.hours) || 0,
      total_amount:            parseFloat(totals.vat ? totals.total : totals.subtotal) || 0,
      vat_amount:              totals.vat ? parseFloat(totals.vat) : null,
      contractor_name:         contractorName,
      contractor_company_name: hrRec?.company_name        || null,
      contractor_vat_number:   hrRec?.company_vat_number  || null,
      contractor_utr:          hrRec?.utr_number           || null,
      shift_ids:               shift_ids || [],
      pdf_path:                pdfPath,
      sent_to:                 toEmail,
      sent_cc:                 ccEmail || null,
      created_by:              officer.id,
    });
    if (insertErr) throw insertErr;

    // 5. Send email (record already exists — safe to proceed)
    const emailSent = await sendEmail({
      to: toEmail,
      ...(ccEmail ? { cc: ccEmail } : {}),
      from: { email: fromEmail, name: 'DOB Live' },
      subject: `Invoice ${invoiceRef} — ${contractor.name || `${officer.first_name} ${officer.last_name}`} — ${month}`,
      html: buildEmailHtml(invoiceRef, contractor, officer, month, totals),
      attachments: [{ content: pdfBuffer.toString('base64'), filename: `Invoice-${invoiceRef}.pdf`, type: 'application/pdf', disposition: 'attachment' }],
    });
    if (emailSent) console.log('[Invoice] Email sent to', toEmail, ccEmail ? `cc: ${ccEmail}` : '');

    res.json({ success: true, emailSent, invoiceRef });
  } catch (err) { next(err); }
});

// ── Invoice helpers ───────────────────────────────────────────────────────────

function buildPdf(PDFDocument, invoiceRef, month, shifts, contractor, totals, officer, today) {
  return new Promise((resolve, reject) => {
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
      const officerName = contractor.name || `${officer.first_name} ${officer.last_name}`;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0b1a3e')
        .text(officerName, fromX, 20, { width: 200, align: 'right' });
      let fy = 36;
      if (officer.employee_number) { doc.fontSize(8).font('Helvetica').fillColor('#6b7280').text(officer.employee_number, fromX, fy, { width: 200, align: 'right' }); fy += 12; }
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
      doc.text('128 City Road', M + CW / 2, y); y += 12;
      doc.text(`SIA Expiry: ${contractor.sia_expiry || '—'}`, M, y);
      doc.text('London EC1V 2NX', M + CW / 2, y); y += 12;
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
      for (const s of shifts) {
        if (y > 700) { doc.addPage(); y = 40; }
        doc.fontSize(8).font('Helvetica').fillColor('#111827');
        doc.text(s.date, cols[0], y, { lineBreak: false });
        doc.text(s.site, cols[1], y, { width: 115, lineBreak: false });
        doc.text(s.times, cols[2], y, { lineBreak: false });
        doc.text(s.hours, cols[3], y, { width: 60, align: 'right', lineBreak: false });
        doc.text(`£${s.rate}`, cols[4], y, { width: 50, align: 'right', lineBreak: false });
        doc.font('Helvetica-Bold').fillColor('#111827');
        doc.text(`£${s.amount}`, cols[5], y, { width: 65, align: 'right', lineBreak: false });
        y += 16;
        if (s.bh_hours) {
          doc.fontSize(7).font('Helvetica-Bold').fillColor('#dc2626');
          doc.text('Bank Holiday Premium', cols[1], y, { lineBreak: false });
          doc.text(s.bh_hours, cols[3], y, { width: 60, align: 'right', lineBreak: false });
          doc.text(`£${s.rate}`, cols[4], y, { width: 50, align: 'right', lineBreak: false });
          doc.text(`£${s.bh_amount}`, cols[5], y, { width: 65, align: 'right', lineBreak: false });
          y += 14;
        }
        doc.rect(M, y - 2, CW, 0.25).fill('#f1f5f9');
      }

      // Site summary
      const siteMap = {};
      for (const s of shifts) {
        if (!siteMap[s.site]) siteMap[s.site] = { hours: 0, pay: 0 };
        siteMap[s.site].hours += parseFloat(s.hours)     || 0;
        siteMap[s.site].pay   += parseFloat(s.amount)    || 0;
        if (s.bh_hours) {
          siteMap[s.site].hours += parseFloat(s.bh_hours)  || 0;
          siteMap[s.site].pay   += parseFloat(s.bh_amount) || 0;
        }
      }
      const siteRows = Object.entries(siteMap)
        .map(([name, v]) => ({ name, hours: v.hours, pay: v.pay }))
        .sort((a, b) => b.hours - a.hours);

      y += 12;
      doc.rect(M, y, CW, 0.5).fill('#e2e8f0'); y += 8;
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#6b7280').text('SUMMARY BY SITE', M, y); y += 12;

      const scols = [M, M + CW - 120, M + CW - 50];
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#6b7280');
      doc.text('SITE',  scols[0], y);
      doc.text('HOURS', scols[1], y, { width: 60, align: 'right' });
      doc.text('PAY',   scols[2], y, { width: 65, align: 'right' });
      y += 12; doc.rect(M, y - 2, CW, 0.5).fill('#e5e7eb');

      let siteTotalHours = 0, siteTotalPay = 0;
      for (const row of siteRows) {
        if (y > 700) { doc.addPage(); y = 40; }
        doc.fontSize(8).font('Helvetica').fillColor('#111827');
        doc.text(row.name, scols[0], y, { width: CW - 130, lineBreak: false });
        doc.text(row.hours.toFixed(2), scols[1], y, { width: 60, align: 'right', lineBreak: false });
        doc.text(`£${row.pay.toFixed(2)}`, scols[2], y, { width: 65, align: 'right', lineBreak: false });
        y += 14;
        siteTotalHours += row.hours;
        siteTotalPay   += row.pay;
      }
      doc.rect(M, y, CW, 0.75).fill('#0b1a3e'); y += 8;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0b1a3e');
      doc.text('Total', scols[0], y);
      doc.text(siteTotalHours.toFixed(2), scols[1], y, { width: 60, align: 'right' });
      doc.text(`£${siteTotalPay.toFixed(2)}`, scols[2], y, { width: 65, align: 'right' });
      y += 20;

      // Totals
      y += 8; doc.rect(M, y, CW, 1.5).fill('#0b1a3e'); y += 10;
      const hoursLabel = totals.bh_hours ? `Total Hours: ${totals.hours} + ${totals.bh_hours} BH` : `Total Hours: ${totals.hours}`;
      doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
        .text(hoursLabel, M, y);
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

      // Bank details & Payment terms
      y += 8;
      doc.rect(M, y, CW, 0.5).fill('#e2e8f0'); y += 10;
      if (contractor.bank_account_holder || contractor.bank_sort_code) {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151').text('Bank Details for Payment', M, y); y += 14;
        doc.fontSize(8).font('Helvetica').fillColor('#374151');
        if (contractor.bank_account_holder) { doc.text(`Account Holder: ${contractor.bank_account_holder}`, M, y); y += 13; }
        if (contractor.bank_name) { doc.text(`Bank: ${contractor.bank_name}`, M, y); y += 13; }
        if (contractor.bank_sort_code) { doc.text(`Sort Code: ${contractor.bank_sort_code}`, M, y); y += 13; }
        if (contractor.bank_account_number) { doc.text(`Account Number: ${contractor.bank_account_number}`, M, y); y += 13; }
        y += 6;
      }
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151').text('Payment Terms', M, y); y += 14;
      doc.fontSize(7).font('Helvetica').fillColor('#6b7280')
        .text(`Payment due within 30 days of invoice date. Please reference invoice number ${invoiceRef} with payment.`, M, y, { width: CW });

      doc.end();
  });
}

function buildEmailHtml(invoiceRef, contractor, officer, month, totals) {
  const name = contractor.name || `${officer.first_name} ${officer.last_name}`;
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0b1a3e;padding:20px 24px;border-radius:8px 8px 0 0;border-top:4px solid #1a52a8;">
        <h1 style="color:#fff;margin:0;font-size:18px;">DOB Live — Invoice Submission</h1>
      </div>
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;background:#fff;">
        <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
          <tr><td style="padding:6px 0;font-weight:600;width:120px;">Invoice Ref:</td><td>${invoiceRef}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600;">Contractor:</td><td>${name}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600;">Period:</td><td>${month}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600;">Total Hours:</td><td>${totals.hours}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600;">Amount:</td><td><strong>£${totals.vat ? totals.total : totals.subtotal}</strong></td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Full invoice attached as PDF.</p>
      </div>
    </div>
  `;
}

module.exports = router;
