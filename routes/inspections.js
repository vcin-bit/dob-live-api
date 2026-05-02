const router = require('express').Router();
const multer = require('multer');
const PDFDocument = require('pdfkit');
const https = require('https');
const http = require('http');
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

// Download image as buffer
function downloadImage(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
  });
}

// ── Generate PDF ────────────────────────────────────────────────────────────
async function generatePDF(inspection, site, logoBuffer, photoBuffers) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;   // 595
    const M = 40;               // margin
    const CW = W - M * 2;      // content width
    const navy = '#0b1a3e';
    const blue = '#1a52a8';
    const grey = '#6b7280';
    const lightBg = '#f8fafc';
    const border = '#e2e8f0';

    const dateStr = new Date(inspection.inspected_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = new Date(inspection.inspected_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    const refNo = `INS-${inspection.id.slice(0,8).toUpperCase()}`;
    const siteAddress = [site?.address, site?.city, site?.postcode].filter(Boolean).join(', ');

    // ── Header ──────────────────────────────────────────────────────────
    doc.rect(0, 0, W, 90).fill(navy);

    // Logo
    if (logoBuffer) {
      try { doc.image(logoBuffer, M, 18, { height: 36 }); } catch {}
    } else {
      doc.fontSize(20).fillColor('#fff').font('Helvetica-Bold').text('Risk Secured', M, 28);
    }

    // Right side header info
    doc.fontSize(8).fillColor('rgba(255,255,255,0.5)').font('Helvetica')
      .text('PROPERTY INSPECTION REPORT', W - M - 180, 20, { width: 180, align: 'right' })
      .text(refNo, W - M - 180, 32, { width: 180, align: 'right' });
    doc.fontSize(9).fillColor('rgba(255,255,255,0.7)')
      .text(`${dateStr}`, W - M - 180, 48, { width: 180, align: 'right' })
      .text(`${timeStr}`, W - M - 180, 60, { width: 180, align: 'right' });

    // Client badge
    doc.rect(M, 74, 100, 14).fill('rgba(255,255,255,0.1)');
    doc.fontSize(7).fillColor('rgba(255,255,255,0.6)').font('Helvetica-Bold')
      .text('ALDI STORES LTD', M + 6, 77);

    let y = 105;

    // ── Helper: draw a boxed section ────────────────────────────────────
    function sectionBox(title, contentFn) {
      doc.rect(M, y, CW, 1).fill(border);
      y += 1;
      // Title bar
      doc.rect(M, y, CW, 22).fill(lightBg);
      doc.rect(M, y, CW, 22).lineWidth(0.5).strokeColor(border).stroke();
      doc.fontSize(7).fillColor(grey).font('Helvetica-Bold')
        .text(title.toUpperCase(), M + 10, y + 7, { width: CW - 20 });
      y += 22;
      // Content area
      const startY = y;
      contentFn();
      const endY = y;
      doc.rect(M, startY, CW, endY - startY).lineWidth(0.5).strokeColor(border).stroke();
      y += 8;
    }

    // ── Site Details ────────────────────────────────────────────────────
    sectionBox('Site Details', () => {
      const col1 = M + 12;
      const col2 = M + CW / 2;
      doc.fontSize(7).fillColor(grey).font('Helvetica').text('SITE NAME', col1, y + 6);
      doc.fontSize(10).fillColor('#111827').font('Helvetica-Bold').text(inspection.site_name, col1, y + 17);
      doc.fontSize(7).fillColor(grey).font('Helvetica').text('ADDRESS', col1, y + 34);
      doc.fontSize(9).fillColor('#111827').font('Helvetica').text(siteAddress || '—', col1, y + 45, { width: CW / 2 - 20 });

      doc.fontSize(7).fillColor(grey).font('Helvetica').text('INSPECTOR', col2, y + 6);
      doc.fontSize(10).fillColor('#111827').font('Helvetica-Bold').text(inspection.inspector_name, col2, y + 17);
      doc.fontSize(7).fillColor(grey).font('Helvetica').text('DATE / TIME', col2, y + 34);
      doc.fontSize(9).fillColor('#111827').font('Helvetica').text(`${dateStr} at ${timeStr}`, col2, y + 45);
      y += 64;
    });

    // ── Status ──────────────────────────────────────────────────────────
    const statusColor = inspection.new_to_report ? '#dc2626' : '#16a34a';
    const statusBg = inspection.new_to_report ? '#fef2f2' : '#f0fdf4';
    const statusBorder = inspection.new_to_report ? '#fca5a5' : '#86efac';
    const statusText = inspection.new_to_report ? 'ISSUES REPORTED — ACTION REQUIRED' : 'ALL CLEAR — NO NEW ISSUES';

    doc.roundedRect(M, y, CW, 32, 4).lineWidth(1.5).strokeColor(statusBorder).fillAndStroke(statusBg, statusBorder);
    doc.fontSize(11).fillColor(statusColor).font('Helvetica-Bold')
      .text(statusText, M + 14, y + 10, { width: CW - 28 });
    y += 44;

    // ── Immediate Intervention ──────────────────────────────────────────
    if (inspection.immediate_action) {
      doc.roundedRect(M, y, CW, 32, 4).fill('#dc2626');
      doc.fontSize(11).fillColor('#fff').font('Helvetica-Bold')
        .text('IMMEDIATE INTERVENTION REQUIRED', M + 14, y + 10, { width: CW - 28 });
      y += 44;
    }

    // ── Categories ──────────────────────────────────────────────────────
    if (inspection.categories?.length > 0) {
      sectionBox('Categories', () => {
        let cx = M + 12;
        let cy = y + 8;
        inspection.categories.forEach(cat => {
          const tw = doc.widthOfString(cat, { fontSize: 8 }) + 16;
          if (cx + tw > M + CW - 12) { cx = M + 12; cy += 20; }
          doc.roundedRect(cx, cy, tw, 18, 9).fill(blue);
          doc.fontSize(8).fillColor('#fff').font('Helvetica-Bold').text(cat, cx + 8, cy + 4);
          cx += tw + 6;
        });
        y = cy + 28;
      });
    }

    // ── Report Summary ──────────────────────────────────────────────────
    if (inspection.summary) {
      sectionBox('Report Summary', () => {
        doc.fontSize(10).fillColor('#111827').font('Helvetica')
          .text(inspection.summary, M + 12, y + 8, { width: CW - 24, lineGap: 3 });
        y += doc.heightOfString(inspection.summary, { width: CW - 24, fontSize: 10, lineGap: 3 }) + 18;
      });
    }

    // ── Action Points ───────────────────────────────────────────────────
    if (inspection.action_points) {
      sectionBox('Suggested Action Points', () => {
        doc.fontSize(10).fillColor('#111827').font('Helvetica')
          .text(inspection.action_points, M + 12, y + 8, { width: CW - 24, lineGap: 3 });
        y += doc.heightOfString(inspection.action_points, { width: CW - 24, fontSize: 10, lineGap: 3 }) + 18;
      });
    }

    // ── GPS Location ────────────────────────────────────────────────────
    if (inspection.latitude && inspection.longitude) {
      sectionBox('Location', () => {
        doc.fontSize(9).fillColor('#111827').font('Helvetica')
          .text(`GPS: ${inspection.latitude.toFixed(6)}, ${inspection.longitude.toFixed(6)}`, M + 12, y + 8);
        y += 24;
      });
    }

    // ── Photographs ─────────────────────────────────────────────────────
    if (photoBuffers?.length > 0) {
      const validPhotos = photoBuffers.filter(Boolean);
      if (validPhotos.length > 0) {
        // Check if we need a new page
        if (y > 500) { doc.addPage(); y = 40; }

        doc.rect(M, y, CW, 1).fill(border);
        y += 1;
        doc.rect(M, y, CW, 22).fill(lightBg);
        doc.rect(M, y, CW, 22).lineWidth(0.5).strokeColor(border).stroke();
        doc.fontSize(7).fillColor(grey).font('Helvetica-Bold')
          .text(`PHOTOGRAPHS (${validPhotos.length})`, M + 10, y + 7);
        y += 26;

        const photoW = (CW - 16) / 2;
        const photoH = 180;
        validPhotos.forEach((buf, i) => {
          if (y + photoH + 10 > doc.page.height - 60) { doc.addPage(); y = 40; }
          const x = M + 4 + (i % 2) * (photoW + 8);
          try {
            doc.image(buf, x, y, { width: photoW, height: photoH, fit: [photoW, photoH], align: 'center', valign: 'center' });
          } catch {}
          if (i % 2 === 1 || i === validPhotos.length - 1) y += photoH + 8;
        });
        y += 4;
      }
    }

    // ── Footer on all pages ─────────────────────────────────────────────
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      const fY = doc.page.height - 45;
      doc.rect(0, fY, W, 45).fill(navy);
      doc.fontSize(7).fillColor('rgba(255,255,255,0.5)').font('Helvetica')
        .text('Risk Secured Consultancy  |  Tel: 0843 122 1247  |  Mobile: 07587 865219  |  Email: david@risksecured.co.uk', M, fY + 10, { width: CW })
        .text('Web: www.risksecured.co.uk  |  24/7 Control Room: 01384 218829', M, fY + 22, { width: CW });
      doc.fontSize(7).fillColor('rgba(255,255,255,0.35)')
        .text(`Page ${i + 1} of ${pageCount}`, W - M - 80, fY + 16, { width: 80, align: 'right' });
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
    const { data: site } = await supabase.from('sites').select('id, name, address, city, postcode, client_name').eq('id', site_id).single();
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

    // Download logo + photos for embedding in PDF
    const logoUrl = 'https://bxesqjzkuredqzvepomn.supabase.co/storage/v1/object/public/company-logos/4bab41dd-f6a9-4407-983b-d42d32ea1432/logo.png';
    const [logoBuffer, ...photoBuffers] = await Promise.all([
      downloadImage(logoUrl),
      ...(media || []).map(m => m.url ? downloadImage(m.url) : Promise.resolve(null)),
    ]);

    // Generate PDF
    const pdfBuffer = await generatePDF(data, site, logoBuffer, photoBuffers);

    // Upload PDF to Supabase storage
    const pdfPath = `${req.user.company_id}/inspections/${data.id}.pdf`;
    await supabase.storage.from('documents').upload(pdfPath, pdfBuffer, {
      contentType: 'application/pdf', upsert: true
    });
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(pdfPath);

    // Update record with PDF path
    await supabase.from('property_inspections').update({ pdf_path: pdfPath }).eq('id', data.id);

    // Save as site document
    await supabase.from('site_documents').insert({
      company_id: req.user.company_id,
      site_id,
      name: `Property Inspection — ${site?.name} — ${new Date().toLocaleDateString('en-GB')}`,
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
      try {
        await sg.send({
          to: ALDI_EMAIL,
          from: { email: RS_EMAIL, name: 'Risk Secured' },
          subject,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:#0b1a3e;padding:20px 24px;border-radius:8px 8px 0 0;">
                <h1 style="color:#fff;margin:0;font-size:20px;">Risk Secured</h1>
                <p style="color:rgba(255,255,255,0.5);margin:4px 0 0;font-size:13px;">Property Inspection Report — Aldi Stores Ltd</p>
              </div>
              <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                <p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>Site:</strong> ${site?.name}</p>
                <p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>Address:</strong> ${[site?.address, site?.city, site?.postcode].filter(Boolean).join(', ')}</p>
                <p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>Inspector:</strong> ${inspector_name}</p>
                <p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB', {day:'2-digit',month:'long',year:'numeric'})}</p>
                <p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>Status:</strong> ${new_to_report ? '<span style="color:#dc2626;font-weight:700;">Issues reported</span>' : '<span style="color:#16a34a;">All clear</span>'}</p>
                ${summary ? `<p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>Summary:</strong> ${summary}</p>` : ''}
                ${action_points ? `<p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>Actions:</strong> ${action_points}</p>` : ''}
                ${immediate_action ? '<p style="margin:16px 0;padding:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;color:#dc2626;font-weight:700;font-size:14px;">IMMEDIATE INTERVENTION REQUIRED</p>' : ''}
                <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">Full report with photographs attached as PDF.</p>
              </div>
              <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:16px;">Risk Secured Consultancy | 24/7 Control Room: 01384 218829</p>
            </div>
          `,
          attachments: [{
            content: pdfBase64,
            filename: `Risk-Secured-Inspection-${site?.name?.replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment',
          }],
        });
      } catch (emailErr) { console.error('Email failed:', emailErr.message); }
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

// ── GET /api/inspections/:id/pdf — signed URL ──────────────────────────────
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
