const router = require('express').Router();
const multer = require('multer');
const PDFDocument = require('pdfkit');
const supabase = require('../lib/supabase');
const { authenticate } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function getSg() {
  if (!process.env.SENDGRID_API_KEY) return null;
  const sg = require('@sendgrid/mail');
  sg.setApiKey(process.env.SENDGRID_API_KEY);
  return sg;
}

const ALDI_EMAIL = process.env.ALDI_INSPECTION_EMAIL || 'david@risksecured.co.uk';
const RS_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'onboarding@doblive.co.uk';

const CATEGORIES = [
  'Fly Tipping','Forced Entry','Travellers','Safety Concern',
  'Property Breached','Criminal Damage','Graffiti','Suspicious Activity',
  'Anti-Social Behaviour','Fire Risk','Water Leak','Broken Fencing',
  'Lighting Issue','Other'
];

// ── Generate PDF ────────────────────────────────────────────────────────────
function generatePDF(inspection, photoUrls) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const navy = '#0b1a3e';
    const blue = '#1a52a8';
    const grey = '#6b7280';
    const lightGrey = '#f3f4f6';

    // Header bar
    doc.rect(0, 0, doc.page.width, 80).fill(navy);
    doc.fontSize(22).fillColor('#fff').font('Helvetica-Bold').text('Risk Secured', 50, 20);
    doc.fontSize(10).fillColor('rgba(255,255,255,0.6)').font('Helvetica').text('Property Inspection Report', 50, 48);
    doc.fontSize(9).fillColor('rgba(255,255,255,0.4)').text('Aldi Stores Ltd', 50, 62);

    // Report reference + date (right side)
    const dateStr = new Date(inspection.inspected_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = new Date(inspection.inspected_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    doc.fontSize(9).fillColor('rgba(255,255,255,0.7)').text(`${dateStr} at ${timeStr}`, 350, 25, { width: 200, align: 'right' });
    doc.text(`Ref: INS-${inspection.id.slice(0,8).toUpperCase()}`, 350, 40, { width: 200, align: 'right' });

    let y = 100;

    // Info grid
    const field = (label, value, x, w) => {
      doc.fontSize(7).fillColor(grey).font('Helvetica-Bold').text(label.toUpperCase(), x, y, { width: w });
      doc.fontSize(10).fillColor('#111827').font('Helvetica').text(value || '—', x, y + 11, { width: w });
    };

    doc.rect(50, y - 8, doc.page.width - 100, 50).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
    field('Site', inspection.site_name, 58, 200);
    field('Inspector', inspection.inspector_name, 260, 150);
    field('Date / Time', `${dateStr}  ${timeStr}`, 410, 140);
    y += 58;

    // New to report
    doc.rect(50, y, doc.page.width - 100, 28).fill(inspection.new_to_report ? '#fef2f2' : '#f0fdf4');
    doc.fontSize(9).fillColor(inspection.new_to_report ? '#dc2626' : '#16a34a').font('Helvetica-Bold')
      .text(inspection.new_to_report ? 'NEW ISSUES TO REPORT' : 'NOTHING NEW TO REPORT', 58, y + 8);
    y += 40;

    // Categories
    if (inspection.categories?.length > 0) {
      doc.fontSize(7).fillColor(grey).font('Helvetica-Bold').text('CATEGORIES', 50, y);
      y += 14;
      const catText = inspection.categories.join('  |  ');
      doc.fontSize(9).fillColor(blue).font('Helvetica-Bold').text(catText, 50, y, { width: doc.page.width - 100 });
      y += doc.heightOfString(catText, { width: doc.page.width - 100, fontSize: 9 }) + 12;
    }

    // Report summary
    if (inspection.summary) {
      doc.fontSize(7).fillColor(grey).font('Helvetica-Bold').text('REPORT SUMMARY', 50, y);
      y += 14;
      doc.fontSize(10).fillColor('#111827').font('Helvetica').text(inspection.summary, 50, y, { width: doc.page.width - 100, lineGap: 3 });
      y += doc.heightOfString(inspection.summary, { width: doc.page.width - 100, fontSize: 10, lineGap: 3 }) + 16;
    }

    // Action points
    if (inspection.action_points) {
      doc.fontSize(7).fillColor(grey).font('Helvetica-Bold').text('SUGGESTED ACTION POINTS', 50, y);
      y += 14;
      doc.fontSize(10).fillColor('#111827').font('Helvetica').text(inspection.action_points, 50, y, { width: doc.page.width - 100, lineGap: 3 });
      y += doc.heightOfString(inspection.action_points, { width: doc.page.width - 100, fontSize: 10, lineGap: 3 }) + 16;
    }

    // Immediate intervention
    if (inspection.immediate_action) {
      doc.rect(50, y, doc.page.width - 100, 28).fill('#dc2626');
      doc.fontSize(10).fillColor('#fff').font('Helvetica-Bold').text('IMMEDIATE INTERVENTION REQUIRED', 58, y + 8);
      y += 40;
    }

    // GPS
    if (inspection.latitude && inspection.longitude) {
      doc.fontSize(7).fillColor(grey).font('Helvetica-Bold').text('LOCATION', 50, y);
      y += 14;
      doc.fontSize(9).fillColor('#111827').font('Helvetica').text(`GPS: ${inspection.latitude.toFixed(6)}, ${inspection.longitude.toFixed(6)}`, 50, y);
      y += 18;
    }

    // Photos
    if (photoUrls?.length > 0) {
      if (y > 600) { doc.addPage(); y = 50; }
      doc.fontSize(7).fillColor(grey).font('Helvetica-Bold').text(`PHOTOGRAPHS (${photoUrls.length})`, 50, y);
      y += 16;
      // Photos will be added as references (URLs) since we can't embed remote images in pdfkit easily
      photoUrls.forEach((url, i) => {
        if (y > 750) { doc.addPage(); y = 50; }
        doc.fontSize(9).fillColor(blue).font('Helvetica').text(`Photo ${i + 1}: ${url}`, 50, y, { width: doc.page.width - 100, underline: true });
        y += 14;
      });
      y += 8;
    }

    // Footer
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.rect(0, doc.page.height - 50, doc.page.width, 50).fill(lightGrey);
      doc.fontSize(7).fillColor(grey).font('Helvetica')
        .text('Risk Secured Consultancy  |  Tel: 0843 122 1247  |  Mobile: 07587 865219', 50, doc.page.height - 38)
        .text('Email: david@risksecured.co.uk  |  Web: www.risksecured.co.uk', 50, doc.page.height - 28)
        .text(`4/7 Control Room: 01384 218829`, 50, doc.page.height - 18);
      doc.text(`Page ${i + 1} of ${pageCount}`, 400, doc.page.height - 28, { width: 150, align: 'right' });
    }

    doc.end();
  });
}

// ── POST /api/inspections — submit inspection ───────────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      site_id, new_to_report, categories, summary, action_points,
      immediate_action, latitude, longitude, media
    } = req.body;

    // Get site + inspector info
    const { data: site } = await supabase.from('sites').select('id, name, client_name').eq('id', site_id).single();
    const inspector_name = `${req.user.first_name} ${req.user.last_name}`;

    const record = {
      company_id: req.user.company_id,
      site_id,
      inspector_id: req.user.id,
      inspector_name,
      site_name: site?.name || 'Unknown',
      client_name: site?.client_name || 'Aldi Stores Ltd',
      new_to_report: new_to_report || false,
      categories: categories || [],
      summary: summary || '',
      action_points: action_points || '',
      immediate_action: immediate_action || false,
      latitude: latitude || null,
      longitude: longitude || null,
      media: media || [],
      inspected_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('property_inspections')
      .insert(record)
      .select()
      .single();
    if (error) throw error;

    // Generate PDF
    const photoUrls = (media || []).map(m => m.url).filter(Boolean);
    const pdfBuffer = await generatePDF(data, photoUrls);

    // Upload PDF to Supabase storage (documents bucket is public)
    const pdfPath = `${req.user.company_id}/inspections/${data.id}.pdf`;
    await supabase.storage.from('documents').upload(pdfPath, pdfBuffer, {
      contentType: 'application/pdf', upsert: true
    });
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(pdfPath);

    // Update record with PDF path
    await supabase.from('property_inspections').update({ pdf_path: pdfPath }).eq('id', data.id);

    // Also save as a site document for the DOBLive folder
    await supabase.from('site_documents').insert({
      company_id: req.user.company_id,
      site_id,
      name: `Inspection — ${site?.name} — ${new Date().toLocaleDateString('en-GB')}`,
      original_name: `inspection-${data.id.slice(0,8)}.pdf`,
      mime_type: 'application/pdf',
      storage_path: pdfPath,
      uploaded_by: req.user.id,
    });

    // Email to Aldi
    const sg = getSg();
    if (sg) {
      const pdfBase64 = pdfBuffer.toString('base64');
      const subject = `Property Inspection — ${site?.name} — ${new Date().toLocaleDateString('en-GB')}`;

      // Send to Aldi
      try {
        await sg.send({
          to: ALDI_EMAIL,
          from: { email: RS_EMAIL, name: 'Risk Secured' },
          subject,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:#0b1a3e;padding:20px 24px;border-radius:8px 8px 0 0;">
                <h1 style="color:#fff;margin:0;font-size:20px;">Risk Secured</h1>
                <p style="color:rgba(255,255,255,0.5);margin:4px 0 0;font-size:13px;">Property Inspection Report</p>
              </div>
              <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                <p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>Site:</strong> ${site?.name}</p>
                <p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>Inspector:</strong> ${inspector_name}</p>
                <p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB', {day:'2-digit',month:'long',year:'numeric'})}</p>
                <p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>Status:</strong> ${new_to_report ? '<span style="color:#dc2626;font-weight:700;">New issues reported</span>' : '<span style="color:#16a34a;">Nothing new to report</span>'}</p>
                ${summary ? `<p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>Summary:</strong> ${summary}</p>` : ''}
                ${action_points ? `<p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>Actions:</strong> ${action_points}</p>` : ''}
                ${immediate_action ? '<p style="margin:16px 0;padding:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;color:#dc2626;font-weight:700;font-size:14px;">IMMEDIATE INTERVENTION REQUIRED</p>' : ''}
                <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">Full report attached as PDF.</p>
              </div>
              <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:16px;">Risk Secured Consultancy | 4/7 Control Room: 01384 218829</p>
            </div>
          `,
          attachments: [{
            content: pdfBase64,
            filename: `Risk-Secured-Inspection-${site?.name?.replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment',
          }],
        });
      } catch (emailErr) { console.error('Aldi email failed:', emailErr.message); }
    }

    res.status(201).json({ data, pdf_url: publicUrl });
  } catch (err) { next(err); }
});

// ── GET /api/inspections — list inspections ─────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { site_id, limit = 50 } = req.query;
    let query = supabase.from('property_inspections')
      .select('*')
      .eq('company_id', req.user.company_id)
      .order('inspected_at', { ascending: false })
      .limit(limit);
    if (site_id) query = query.eq('site_id', site_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// ── GET /api/inspections/:id/pdf — get signed URL for PDF ───────────────────
router.get('/:id/pdf', authenticate, async (req, res, next) => {
  try {
    const { data: insp } = await supabase.from('property_inspections')
      .select('pdf_path').eq('id', req.params.id).eq('company_id', req.user.company_id).single();
    if (!insp?.pdf_path) return res.status(404).json({ error: 'PDF not found' });
    const { data: signed, error } = await supabase.storage.from('documents').createSignedUrl(insp.pdf_path, 300);
    if (error) throw error;
    res.json({ url: signed.signedUrl });
  } catch (err) { next(err); }
});

module.exports = router;
