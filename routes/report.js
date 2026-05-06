const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate } = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/report/generate - AI generates professional report narrative
router.post('/generate', authenticate, async (req, res, next) => {
  try {
    const {
      log_type, incident_subtype, description,
      site_name, officer_name, occurred_at,
      police_attended, police_reported, police_incident_number,
      police_force, police_officer_name, police_shoulder_number,
      actions_taken, people_involved, location_detail
    } = req.body;

    const officer = req.user;
    const siaNumber = officer.sia_licence_number || 'not recorded';
    const time = occurred_at ? new Date(occurred_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) + 'hrs' : 'an unspecified time';
    const date = occurred_at ? new Date(occurred_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'an unspecified date';
    const dayOfWeek = occurred_at ? new Date(occurred_at).toLocaleDateString('en-GB', { weekday: 'long' }) : '';

    const prompt = `You are writing a professional security officer's statement in the style of a UK police witness statement (MG11). Write in FIRST PERSON as the officer. Be factual, precise, and professional.

The statement MUST begin with this exact preamble (fill in the details):
"I am ${officer_name || officer.first_name + ' ' + officer.last_name}, a SIA licensed security officer (licence number: ${siaNumber}), employed by Risk Secured Ltd. On ${dayOfWeek} ${date} at approximately ${time}, I was carrying out my duties as the on-site security officer at ${site_name || 'the site'} when"

Then continue naturally into what the officer observed/dealt with based on the facts below. Write in first person throughout ("I observed", "I approached", "I contacted"). Use formal British English. Do not use headings.

Facts provided by the officer:
- Incident type: ${log_type} ${incident_subtype ? `(${incident_subtype})` : ''}
- Description: ${description || 'Not provided'}
${location_detail ? `- Location on site: ${location_detail}` : ''}
${people_involved ? `- Persons involved: ${people_involved}` : ''}
${actions_taken ? `- Actions taken: ${actions_taken}` : ''}
${police_reported ? `- Police notified: Yes${police_force ? `, ${police_force}` : ''}${police_incident_number ? `, crime reference ${police_incident_number}` : ''}` : ''}
${police_attended ? `- Police attended: Yes${police_officer_name ? `, PC ${police_officer_name}` : ''}${police_shoulder_number ? ` (shoulder number ${police_shoulder_number})` : ''}` : ''}

Write 4–8 sentences. End with a professional closing such as confirming what actions were taken and the current status. Do not add information not provided by the officer. Output ONLY the statement text, nothing else.`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const narrative = message.content[0].text.trim();
    res.json({ narrative });
  } catch (err) {
    next(err);
  }
});

// POST /api/report/pdf - Generate branded PDF incident report, store in site file
router.post('/pdf', authenticate, async (req, res, next) => {
  try {
    const PDFDocument = require('pdfkit');
    const { log_id } = req.body;

    const { data: log, error } = await supabase
      .from('occurrence_logs')
      .select('*, site:sites(id, name), officer:users!occurrence_logs_officer_id_fkey(first_name, last_name, sia_licence_number, sia_licence_type)')
      .eq('id', log_id)
      .eq('company_id', req.user.company_id)
      .single();
    if (error || !log) return res.status(404).json({ error: 'Log not found' });

    const { data: company } = await supabase.from('companies').select('name, logo_url').eq('id', req.user.company_id).single();
    const companyName = company?.name || 'Risk Secured Ltd';
    const td = log.type_data || {};
    const officer = log.officer || {};
    const offName = `${officer.first_name || ''} ${officer.last_name || ''}`.trim();
    const siteName = log.site?.name || 'Unknown';
    const ref = log.id.slice(0,8).toUpperCase();
    const dateStr = log.occurred_at ? new Date(log.occurred_at).toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'long', year:'numeric', timeZone:'Europe/London' }) : '';
    const timeStr = log.occurred_at ? new Date(log.occurred_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/London' }) + 'hrs' : '';

    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = 595, M = 40, CW = W - M * 2;
      const isIncident = ['INCIDENT','ALARM','FIRE_ALARM','EMERGENCY'].includes(log.log_type);
      const accentColor = isIncident ? '#dc2626' : log.log_type === 'ALARM' ? '#d97706' : '#1a52a8';

      // Header band
      doc.rect(0, 0, W, 70).fill('#0b1a3e');
      doc.rect(0, 70, W, 3).fill(accentColor);
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#ffffff').text(companyName, M, 16, { width: CW * 0.6 });
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#93c5fd').text('INCIDENT REPORT', M + CW * 0.6, 18, { width: CW * 0.4, align: 'right' });
      doc.fontSize(8).font('Helvetica').fillColor('rgba(255,255,255,0.5)').text('24/7 National Control Room: 01384 218829', M, 50, { width: CW });

      let y = 85;

      // Reference bar
      doc.rect(M, y, CW, 28).fill('#f8fafc');
      doc.rect(M, y, CW, 28).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
      doc.fontSize(8).font('Helvetica').fillColor('#6b7280');
      doc.text(`Ref: ${ref}`, M + 10, y + 9);
      doc.text(`Date: ${dateStr}`, M + CW * 0.33, y + 9);
      doc.text(`Site: ${siteName}`, M + CW * 0.66, y + 9);
      y += 38;

      // Type badge
      doc.fontSize(14).font('Helvetica-Bold').fillColor(accentColor)
        .text(log.log_type.replace(/_/g, ' '), M, y);
      y += 20;
      if (log.title) {
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text(log.title, M, y, { width: CW });
        y += doc.heightOfString(log.title, { width: CW, fontSize: 11 }) + 6;
      }
      doc.rect(M, y, CW, 2).fill(accentColor); y += 14;

      // Officer statement / narrative
      if (log.description) {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#6b7280').text('OFFICER STATEMENT', M, y); y += 14;
        doc.fontSize(10).font('Helvetica').fillColor('#0f172a').text(log.description, M, y, { width: CW, lineGap: 4 });
        y += doc.heightOfString(log.description, { width: CW, fontSize: 10, lineGap: 4 }) + 16;
      }

      // Details table
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#6b7280').text('INCIDENT DETAILS', M, y); y += 14;
      const rows = [
        ['ATTENDING OFFICER', offName || 'Not recorded'],
        ['SIA LICENCE', `${officer.sia_licence_number || 'Not recorded'}${officer.sia_licence_type ? ` (${officer.sia_licence_type})` : ''}`],
        ['DATE & TIME', `${dateStr} at ${timeStr}`],
        ['SITE', siteName],
      ];
      if (td.location_detail) rows.push(['LOCATION ON SITE', td.location_detail]);
      if (td.people_involved) rows.push(['PERSONS INVOLVED', td.people_involved]);
      if (td.actions_taken) rows.push(['ACTIONS TAKEN', td.actions_taken]);
      if (td.police_reported) rows.push(['POLICE NOTIFIED', `Yes${td.police_force ? ` — ${td.police_force}` : ''}${td.police_incident_number ? `, crime ref: ${td.police_incident_number}` : ''}`]);
      if (td.police_attended) rows.push(['POLICE ATTENDED', `Yes${td.police_officer_name ? ` — PC ${td.police_officer_name}` : ''}${td.police_shoulder_number ? ` (${td.police_shoulder_number})` : ''}`]);
      if (log.latitude) rows.push(['GPS COORDINATES', `${parseFloat(log.latitude).toFixed(5)}, ${parseFloat(log.longitude).toFixed(5)}`]);
      if (log.client_reportable) rows.push(['CLIENT NOTIFICATION', 'Sent to client']);

      rows.forEach((r, i) => {
        if (y > 740) { doc.addPage(); y = 40; }
        const rowH = 22;
        doc.rect(M, y, CW, rowH).fill(i % 2 === 0 ? '#f8fafc' : '#ffffff');
        doc.rect(M, y, CW, rowH).lineWidth(0.25).strokeColor('#e2e8f0').stroke();
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#6b7280').text(r[0], M + 10, y + 7, { width: CW * 0.3 });
        doc.fontSize(8.5).font('Helvetica').fillColor('#0f172a').text(r[1], M + CW * 0.35, y + 6, { width: CW * 0.6 });
        y += rowH;
      });
      y += 16;

      // Confidentiality notice
      if (y > 700) { doc.addPage(); y = 40; }
      doc.rect(M, y, CW, 0.5).fill('#e2e8f0'); y += 10;
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#6b7280').text('CONFIDENTIAL', M, y); y += 12;
      doc.fontSize(7).font('Helvetica').fillColor('#9ca3af')
        .text('This incident report is confidential and intended solely for the use of the addressee. It may contain information that is privileged or otherwise protected from disclosure. If you are not the intended recipient, please notify Risk Secured Ltd immediately.', M, y, { width: CW, lineGap: 2 });
      y += 40;

      // Footer on all pages
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        const fY = doc.page.height - 40;
        doc.rect(0, fY, W, 0.5).fill('#e2e8f0');
        doc.fontSize(7).fillColor('#9ca3af').font('Helvetica')
          .text(`${companyName} · Generated by DOB Live · ${new Date().toLocaleDateString('en-GB')} · Page ${i+1} of ${pageCount}`, M, fY + 8, { width: CW, align: 'center' });
      }

      doc.end();
    });

    // Upload to Supabase storage for site file
    const filename = `incident-${ref}-${Date.now()}.pdf`;
    const storagePath = `${req.user.company_id}/${log.site?.id || 'general'}/${filename}`;
    await supabase.storage.from('incident-reports').upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
    const { data: urlData } = supabase.storage.from('incident-reports').getPublicUrl(storagePath);

    // Store reference on the log
    await supabase.from('occurrence_logs').update({ pdf_path: storagePath }).eq('id', log_id);

    res.json({ pdf: pdfBuffer.toString('base64'), filename: `Incident-Report-${ref}.pdf`, url: urlData?.publicUrl || null });
  } catch (err) { next(err); }
});

// POST /api/report/handover — AI generates a full handover brief from shift logs
router.post('/handover', authenticate, async (req, res, next) => {
  try {
    const { shift_id, site_id, checklist_items } = req.body;

    // Get all logs from this shift
    const { data: logs } = await supabase
      .from('occurrence_logs')
      .select('log_type, title, description, occurred_at, type_data')
      .eq('shift_id', shift_id)
      .eq('company_id', req.user.company_id)
      .order('occurred_at', { ascending: true });

    // Get site name
    const { data: site } = await supabase
      .from('sites')
      .select('name')
      .eq('id', site_id)
      .single();

    const officerName = `${req.user.first_name} ${req.user.last_name}`;
    const siteName = site?.name || 'the site';
    const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const logsSummary = (logs || []).map(l =>
      `- [${l.log_type}] ${l.title || l.log_type} at ${new Date(l.occurred_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}: ${l.description || 'No description'}`
    ).join('\n');

    const incidents = (logs || []).filter(l => ['INCIDENT','ALARM','FIRE_ALARM','EMERGENCY'].includes(l.log_type));

    const prompt = `You are writing a professional security officer shift handover brief for ${siteName} on ${date}. The outgoing officer is ${officerName}.

Here are all logs recorded during the shift:
${logsSummary || 'No logs recorded this shift.'}

${checklist_items?.length ? `The outgoing officer has flagged these specific items for the incoming officer:\n${checklist_items.map(i => `- ${i}`).join('\n')}` : ''}

Write a professional handover brief in British English with these sections:
1. SHIFT OVERVIEW — brief summary of the shift (2-3 sentences)
2. INCIDENTS & NOTABLE EVENTS — list any incidents, alarms, or significant events with times. If none, state "No incidents recorded."
3. SITE STATUS — current condition of the site, anything the incoming officer needs to know about
4. OUTSTANDING ACTIONS — anything that needs following up or attention during the next shift
5. KEYS & EQUIPMENT — note anything relevant (if no specific info logged, state "Standard equipment as per site assignment")

Keep it factual, professional, and concise. This will be read and acknowledged by the incoming officer. Output ONLY the brief, no preamble.`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const brief = message.content[0].text.trim();

    // Save to handover_briefs
    const { data: handover, error } = await supabase
      .from('handover_briefs')
      .insert({
        company_id: req.user.company_id,
        site_id,
        shift_id,
        authored_by: req.user.id,
        content: brief,
        checklist: checklist_items || [],
        ai_generated: true,
        status: 'PENDING',
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ brief, handover_id: handover.id });
  } catch (err) { next(err); }
});

// POST /api/report/handover/:id/acknowledge — incoming officer acknowledges handover
router.post('/handover/:id/acknowledge', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('handover_briefs')
      .update({
        acknowledged_by: req.user.id,
        acknowledged_at: new Date().toISOString(),
        status: 'ACKNOWLEDGED',
      })
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/report/handover/pending — get pending handover for current site
router.get('/handover/pending', authenticate, async (req, res, next) => {
  try {
    const { site_id } = req.query;
    const { data } = await supabase
      .from('handover_briefs')
      .select('*, author:authored_by(first_name, last_name)')
      .eq('company_id', req.user.company_id)
      .eq('site_id', site_id)
      .eq('status', 'PENDING')
      .neq('authored_by', req.user.id)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
