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

function downloadImage(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ── Generate PDF ────────────────────────────────────────────────────────────
async function generatePDF(inspection, site, logoBuffer, photoBuffers, mapBuffer) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595;
    const M = 40;
    const CW = W - M * 2;

    const dateStr = new Date(inspection.inspected_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = new Date(inspection.inspected_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    const refNo = `INS-${inspection.id.slice(0,8).toUpperCase()}`;
    const siteAddress = [site?.address, site?.city, site?.postcode].filter(Boolean).join(', ');

    // ════════════════════════════════════════════════════════════════════
    // HEADER — navy band with logo and report title
    // ════════════════════════════════════════════════════════════════════
    doc.rect(0, 0, W, 100).fill('#0b1a3e');
    // Blue accent line at top
    doc.rect(0, 0, W, 4).fill('#1a52a8');

    if (logoBuffer) {
      try { doc.image(logoBuffer, M, 20, { height: 50 }); } catch {}
    } else {
      doc.fontSize(24).fillColor('#ffffff').font('Helvetica-Bold').text('RISK SECURED', M, 30);
    }

    doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold')
      .text('PROPERTY INSPECTION REPORT', W - M - 220, 22, { width: 220, align: 'right' });
    doc.fontSize(9).fillColor('#8899bb')
      .text(`Ref: ${refNo}`, W - M - 220, 38, { width: 220, align: 'right' })
      .text(`${dateStr}`, W - M - 220, 52, { width: 220, align: 'right' })
      .text(`${timeStr}`, W - M - 220, 66, { width: 220, align: 'right' });

    // Aldi badge
    doc.roundedRect(M, 82, 110, 16, 3).fill('#2a3f6e');
    doc.fontSize(8).fillColor('#8899bb').font('Helvetica-Bold')
      .text('ALDI STORES LTD', M + 8, 86);

    let y = 115;

    // ════════════════════════════════════════════════════════════════════
    // HELPER: boxed section with title bar
    // ════════════════════════════════════════════════════════════════════
    function checkPage(need) {
      if (y + need > 780) { doc.addPage(); y = 40; }
    }

    function section(title, height, contentFn) {
      checkPage(height + 30);
      // Title bar
      doc.rect(M, y, CW, 24).fill('#f1f5f9');
      doc.rect(M, y, CW, 24).lineWidth(0.5).strokeColor('#d1d5db').stroke();
      doc.rect(M, y, 3, 24).fill('#1a52a8');
      doc.fontSize(8).fillColor('#475569').font('Helvetica-Bold')
        .text(title.toUpperCase(), M + 12, y + 8, { width: CW - 24 });
      y += 24;
      // Content
      const startY = y;
      contentFn();
      // Bottom + side borders
      doc.rect(M, startY, CW, y - startY).lineWidth(0.5).strokeColor('#d1d5db').stroke();
      y += 10;
    }

    // ════════════════════════════════════════════════════════════════════
    // SITE DETAILS
    // ════════════════════════════════════════════════════════════════════
    section('Site Details', 70, () => {
      const c1 = M + 14;
      const c2 = M + CW * 0.55;
      doc.fontSize(8).fillColor('#6b7280').font('Helvetica').text('SITE', c1, y + 8);
      doc.fontSize(12).fillColor('#111827').font('Helvetica-Bold').text(inspection.site_name, c1, y + 20);
      doc.fontSize(9).fillColor('#6b7280').font('Helvetica').text(siteAddress || '—', c1, y + 36, { width: CW * 0.5 - 20 });

      doc.fontSize(8).fillColor('#6b7280').font('Helvetica').text('INSPECTOR', c2, y + 8);
      doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold').text(inspection.inspector_name, c2, y + 20);
      doc.fontSize(8).fillColor('#6b7280').font('Helvetica').text('DATE & TIME', c2, y + 38);
      doc.fontSize(10).fillColor('#111827').font('Helvetica').text(`${dateStr} at ${timeStr}`, c2, y + 50);
      y += 68;
    });

    // ════════════════════════════════════════════════════════════════════
    // STATUS BANNER
    // ════════════════════════════════════════════════════════════════════
    checkPage(40);
    if (inspection.new_to_report) {
      doc.roundedRect(M, y, CW, 36, 4).fill('#fef2f2');
      doc.roundedRect(M, y, CW, 36, 4).lineWidth(1.5).strokeColor('#f87171').stroke();
      doc.fontSize(12).fillColor('#dc2626').font('Helvetica-Bold')
        .text('ISSUES REPORTED — ACTION REQUIRED', M + 16, y + 11, { width: CW - 32 });
    } else {
      doc.roundedRect(M, y, CW, 36, 4).fill('#f0fdf4');
      doc.roundedRect(M, y, CW, 36, 4).lineWidth(1.5).strokeColor('#4ade80').stroke();
      doc.fontSize(12).fillColor('#16a34a').font('Helvetica-Bold')
        .text('ALL CLEAR — NO NEW ISSUES TO REPORT', M + 16, y + 11, { width: CW - 32 });
    }
    y += 48;

    // Immediate intervention
    if (inspection.immediate_action) {
      checkPage(40);
      doc.roundedRect(M, y, CW, 36, 4).fill('#dc2626');
      doc.fontSize(13).fillColor('#ffffff').font('Helvetica-Bold')
        .text('IMMEDIATE INTERVENTION REQUIRED', M + 16, y + 11, { width: CW - 32 });
      y += 48;
    }

    // ════════════════════════════════════════════════════════════════════
    // CATEGORIES
    // ════════════════════════════════════════════════════════════════════
    if (inspection.categories?.length > 0) {
      section('Reported Categories', 40, () => {
        let cx = M + 14;
        let cy = y + 10;
        inspection.categories.forEach(cat => {
          const tw = doc.widthOfString(cat, { fontSize: 9 }) + 20;
          if (cx + tw > M + CW - 14) { cx = M + 14; cy += 24; }
          doc.roundedRect(cx, cy, tw, 20, 10).fill('#1a52a8');
          doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold').text(cat, cx + 10, cy + 5);
          cx += tw + 6;
        });
        y = cy + 32;
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // REPORT SUMMARY
    // ════════════════════════════════════════════════════════════════════
    if (inspection.summary) {
      const h = doc.heightOfString(inspection.summary, { width: CW - 28, fontSize: 10, lineGap: 4 });
      section('Report Summary', h + 20, () => {
        doc.fontSize(10).fillColor('#1e293b').font('Helvetica')
          .text(inspection.summary, M + 14, y + 10, { width: CW - 28, lineGap: 4 });
        y += h + 22;
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // ACTION POINTS
    // ════════════════════════════════════════════════════════════════════
    if (inspection.action_points) {
      const h = doc.heightOfString(inspection.action_points, { width: CW - 28, fontSize: 10, lineGap: 4 });
      section('Suggested Action Points', h + 20, () => {
        doc.fontSize(10).fillColor('#1e293b').font('Helvetica')
          .text(inspection.action_points, M + 14, y + 10, { width: CW - 28, lineGap: 4 });
        y += h + 22;
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // LOCATION + MAP
    // ════════════════════════════════════════════════════════════════════
    if (inspection.latitude && inspection.longitude) {
      const mapH = mapBuffer ? 180 : 30;
      section('Location Verification', mapH + 30, () => {
        doc.fontSize(9).fillColor('#475569').font('Helvetica')
          .text(`GPS Coordinates: ${inspection.latitude.toFixed(6)}, ${inspection.longitude.toFixed(6)}`, M + 14, y + 10);
        y += 26;
        if (mapBuffer) {
          try {
            doc.image(mapBuffer, M + 14, y, { width: CW - 28, height: 170, fit: [CW - 28, 170] });
          } catch {}
          y += 176;
        }
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // PHOTOGRAPHS
    // ════════════════════════════════════════════════════════════════════
    const validPhotos = (photoBuffers || []).filter(Boolean);
    if (validPhotos.length > 0) {
      checkPage(60);
      // Title
      doc.rect(M, y, CW, 24).fill('#f1f5f9');
      doc.rect(M, y, CW, 24).lineWidth(0.5).strokeColor('#d1d5db').stroke();
      doc.rect(M, y, 3, 24).fill('#1a52a8');
      doc.fontSize(8).fillColor('#475569').font('Helvetica-Bold')
        .text(`PHOTOGRAPHIC EVIDENCE (${validPhotos.length})`, M + 12, y + 8);
      y += 30;

      const photoW = Math.floor((CW - 14) / 2);
      const photoH = 200;

      validPhotos.forEach((buf, i) => {
        if (y + photoH + 10 > 780) { doc.addPage(); y = 40; }
        const col = i % 2;
        const x = M + 4 + col * (photoW + 6);
        try {
          // Photo border
          doc.rect(x, y, photoW, photoH).lineWidth(0.5).strokeColor('#d1d5db').stroke();
          doc.image(buf, x + 1, y + 1, { width: photoW - 2, height: photoH - 2, fit: [photoW - 2, photoH - 2], align: 'center', valign: 'center' });
        } catch {}
        // Label
        doc.fontSize(7).fillColor('#9ca3af').font('Helvetica')
          .text(`Photo ${i + 1}`, x, y + photoH + 2, { width: photoW, align: 'center' });
        if (col === 1 || i === validPhotos.length - 1) y += photoH + 16;
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // FOOTER — on all pages
    // ════════════════════════════════════════════════════════════════════
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      const fY = doc.page.height - 60;
      // Accent line
      doc.rect(0, fY, W, 2).fill('#1a52a8');
      // Footer background
      doc.rect(0, fY + 2, W, 58).fill('#0b1a3e');

      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold')
        .text('Risk Secured Consultancy Ltd', M, fY + 10);
      doc.fontSize(7).fillColor('#8899bb').font('Helvetica')
        .text('Tel: 0843 122 1247  |  Mobile: 07587 865219  |  Email: david@risksecured.co.uk', M, fY + 24)
        .text('Web: www.risksecured.co.uk  |  24/7 National Control Room: 01384 218829', M, fY + 36);
      doc.fontSize(7).fillColor('#8899bb')
        .text(`Page ${i + 1} of ${pageCount}`, W - M - 60, fY + 30, { width: 60, align: 'right' });
    }

    doc.end();
  });
}

// ── POST /api/inspections ───────────────────────────────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      site_id, new_to_report, categories, summary, action_points,
      immediate_action, latitude, longitude, media
    } = req.body;

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
      .from('property_inspections').insert(record).select().single();
    if (error) throw error;

    // Download logo, photos, and static map for PDF embedding
    const logoUrl = 'https://bxesqjzkuredqzvepomn.supabase.co/storage/v1/object/public/company-logos/4bab41dd-f6a9-4407-983b-d42d32ea1432/logo.png';
    const mapUrl = latitude && longitude
      ? `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=16&size=800x400&markers=${latitude},${longitude},red-pushpin&maptype=mapnik`
      : null;

    const downloads = [
      downloadImage(logoUrl),
      ...(media || []).map(m => m.url ? downloadImage(m.url) : Promise.resolve(null)),
    ];
    if (mapUrl) downloads.push(downloadImage(mapUrl));

    const results = await Promise.all(downloads);
    const logoBuffer = results[0];
    const photoBuffers = results.slice(1, 1 + (media || []).length);
    const mapBuffer = mapUrl ? results[results.length - 1] : null;

    const pdfBuffer = await generatePDF(data, site, logoBuffer, photoBuffers, mapBuffer);

    // Upload PDF
    const pdfPath = `${req.user.company_id}/inspections/${data.id}.pdf`;
    await supabase.storage.from('documents').upload(pdfPath, pdfBuffer, {
      contentType: 'application/pdf', upsert: true
    });
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(pdfPath);

    await supabase.from('property_inspections').update({ pdf_path: pdfPath }).eq('id', data.id);

    // Save as site document
    await supabase.from('site_documents').insert({
      company_id: req.user.company_id, site_id,
      name: `Property Inspection — ${site?.name} — ${new Date().toLocaleDateString('en-GB')}`,
      original_name: `inspection-${data.id.slice(0,8)}.pdf`,
      mime_type: 'application/pdf', storage_path: pdfPath, uploaded_by: req.user.id,
    });

    // Email
    const sg = getSg();
    if (sg) {
      const pdfBase64 = pdfBuffer.toString('base64');
      try {
        await sg.send({
          to: ALDI_EMAIL,
          from: { email: RS_EMAIL, name: 'Risk Secured' },
          subject: `Property Inspection — ${site?.name} — ${new Date().toLocaleDateString('en-GB')}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:#0b1a3e;padding:20px 24px;border-radius:8px 8px 0 0;border-top:4px solid #1a52a8;">
                <h1 style="color:#fff;margin:0;font-size:18px;">Risk Secured</h1>
                <p style="color:#8899bb;margin:4px 0 0;font-size:12px;">Property Inspection Report — Aldi Stores Ltd</p>
              </div>
              <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;background:#fff;">
                <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
                  <tr><td style="padding:6px 0;font-weight:600;width:100px;">Site:</td><td>${site?.name}</td></tr>
                  <tr><td style="padding:6px 0;font-weight:600;">Address:</td><td>${[site?.address, site?.city, site?.postcode].filter(Boolean).join(', ')}</td></tr>
                  <tr><td style="padding:6px 0;font-weight:600;">Inspector:</td><td>${inspector_name}</td></tr>
                  <tr><td style="padding:6px 0;font-weight:600;">Date:</td><td>${new Date().toLocaleDateString('en-GB', {day:'2-digit',month:'long',year:'numeric'})}</td></tr>
                  <tr><td style="padding:6px 0;font-weight:600;">Status:</td><td>${new_to_report ? '<span style="color:#dc2626;font-weight:700;">Issues Reported</span>' : '<span style="color:#16a34a;font-weight:600;">All Clear</span>'}</td></tr>
                </table>
                ${summary ? `<div style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Summary</div><div style="font-size:14px;color:#1e293b;line-height:1.6;">${summary}</div></div>` : ''}
                ${action_points ? `<div style="margin-top:12px;padding:12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Suggested Actions</div><div style="font-size:14px;color:#1e293b;line-height:1.6;">${action_points}</div></div>` : ''}
                ${immediate_action ? '<div style="margin-top:16px;padding:14px;background:#fef2f2;border:2px solid #fca5a5;border-radius:6px;color:#dc2626;font-weight:700;font-size:14px;text-align:center;">IMMEDIATE INTERVENTION REQUIRED</div>' : ''}
                <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Full report with photographs attached as PDF.</p>
              </div>
              <div style="text-align:center;padding:16px;font-size:11px;color:#9ca3af;">
                Risk Secured Consultancy Ltd | 24/7 National Control Room: 01384 218829<br/>
                Tel: 0843 122 1247 | Mobile: 07587 865219 | david@risksecured.co.uk | www.risksecured.co.uk
              </div>
            </div>
          `,
          attachments: [{
            content: pdfBase64,
            filename: `Risk-Secured-Inspection-${site?.name?.replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}.pdf`,
            type: 'application/pdf', disposition: 'attachment',
          }],
        });
      } catch (emailErr) { console.error('Email failed:', emailErr.message); }
    }

    res.status(201).json({ data, pdf_url: publicUrl });
  } catch (err) { next(err); }
});

// ── GET /api/inspections ────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { site_id, limit = 50 } = req.query;
    let query = supabase.from('property_inspections').select('*')
      .eq('company_id', req.user.company_id)
      .order('inspected_at', { ascending: false }).limit(limit);
    if (site_id) query = query.eq('site_id', site_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// ── GET /api/inspections/:id/pdf ────────────────────────────────────────────
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
