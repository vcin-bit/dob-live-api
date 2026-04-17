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

    const time = occurred_at ? new Date(occurred_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) + 'hrs' : 'an unspecified time';
    const date = occurred_at ? new Date(occurred_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'an unspecified date';

    const prompt = `You are writing a professional security incident report for a licensed security company. Write in formal, third-person British English appropriate for submission to a client. Be factual, precise, and professional — like a well-written police occurrence report.

The officer has provided these raw facts:

- Site: ${site_name || 'the site'}
- Date: ${date}
- Time: ${time}
- Attending officer: ${officer_name || 'the security officer'}
- Incident type: ${log_type} ${incident_subtype ? `(${incident_subtype})` : ''}
- Description: ${description || 'Not provided'}
${location_detail ? `- Location on site: ${location_detail}` : ''}
${people_involved ? `- Persons involved: ${people_involved}` : ''}
${actions_taken ? `- Actions taken: ${actions_taken}` : ''}
${police_reported ? `- Police notified: Yes${police_force ? `, ${police_force}` : ''}${police_incident_number ? `, reference ${police_incident_number}` : ''}` : ''}
${police_attended ? `- Police attended: Yes${police_officer_name ? `, Officer ${police_officer_name}` : ''}${police_shoulder_number ? ` (${police_shoulder_number})` : ''}` : ''}

Write a professional incident report narrative of 3–5 sentences. Start with the time and date. Use "the attending officer" rather than "I". Do not include a heading. Do not add information not provided. Output ONLY the narrative text, nothing else.`;

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

// POST /api/report/pdf - Generate PDF and return base64
router.post('/pdf', authenticate, async (req, res, next) => {
  try {
    const { log_id } = req.body;

    // Get log with all details
    const { data: log, error } = await supabase
      .from('occurrence_logs')
      .select('*, site:sites(name), officer:users(first_name, last_name, sia_licence_number)')
      .eq('id', log_id)
      .eq('company_id', req.user.company_id)
      .single();

    if (error || !log) return res.status(404).json({ error: 'Log not found' });

    const { data: company } = await supabase.from('companies').select('name').eq('id', req.user.company_id).single();

    // Generate PDF using Python
    const { execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    const tmpFile = `/tmp/report_${log_id}.pdf`;

    const py = `
import sys
sys.path.insert(0, '/usr/local/lib/python3/dist-packages')
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
import json, datetime

log = json.loads(sys.argv[1])
company = sys.argv[2]
outfile = sys.argv[3]

doc = SimpleDocTemplate(outfile, pagesize=A4,
    rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)

styles = getSampleStyleSheet()
navy = colors.HexColor('#0b1222')
blue = colors.HexColor('#1a52a8')
red  = colors.HexColor('#dc2626')
grey = colors.HexColor('#64748b')
lt   = colors.HexColor('#f8fafc')

def sty(name, **kw):
    s = ParagraphStyle(name, **kw)
    return s

story = []

# Header bar
story.append(Table(
    [[Paragraph(f'<font color="#ffffff"><b>{company}</b></font>', sty('h', fontName='Helvetica-Bold', fontSize=14, textColor=colors.white)),
      Paragraph('<font color="#93c5fd">INCIDENT REPORT</font>', sty('hr', fontName='Helvetica-Bold', fontSize=11, textColor=colors.HexColor('#93c5fd'), alignment=2))]],
    colWidths=['60%','40%'],
    style=[('BACKGROUND', (0,0),(-1,-1), navy),
           ('TOPPADDING',(0,0),(-1,-1),12),('BOTTOMPADDING',(0,0),(-1,-1),12),
           ('LEFTPADDING',(0,0),(0,-1),14),('RIGHTPADDING',(-1,0),(-1,-1),14)]
))
story.append(Spacer(1, 0.4*cm))

# Reference + Date row
ts = log.get('occurred_at','')[:19].replace('T',' ') if log.get('occurred_at') else ''
ref = log.get('id','')[:8].upper()
story.append(Table(
    [[Paragraph(f'<b>Ref:</b> {ref}', sty('r', fontName='Helvetica', fontSize=9, textColor=grey)),
      Paragraph(f'<b>Date/Time:</b> {ts}', sty('d', fontName='Helvetica', fontSize=9, textColor=grey)),
      Paragraph(f'<b>Site:</b> {log.get("site",{}).get("name","") if isinstance(log.get("site"),dict) else ""}', sty('s', fontName='Helvetica', fontSize=9, textColor=grey))]],
    colWidths=['33%','34%','33%'],
    style=[('BACKGROUND',(0,0),(-1,-1),lt),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),
           ('LEFTPADDING',(0,0),(-1,-1),10),('BOX',(0,0),(-1,-1),0.5,colors.HexColor('#e2e8f0'))]
))
story.append(Spacer(1, 0.5*cm))

# Type badge
lt_map = {'INCIDENT':'#dc2626','ALARM':'#d97706','PATROL':'#2563eb','FIRE_ALARM':'#dc2626','EMERGENCY':'#dc2626'}
tc = lt_map.get(log.get('log_type',''),'#1a52a8')
story.append(Paragraph(f'<font color="{tc}"><b>{log.get("log_type","").replace("_"," ")}</b></font>', 
    sty('type', fontName='Helvetica-Bold', fontSize=16, spaceAfter=6)))
story.append(Paragraph(log.get('title',''), sty('title', fontName='Helvetica-Bold', fontSize=12, textColor=colors.HexColor('#0f172a'), spaceAfter=10)))
story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor(tc), spaceAfter=10))

# Narrative
if log.get('description'):
    story.append(Paragraph('OCCURRENCE NARRATIVE', sty('sh', fontName='Helvetica-Bold', fontSize=8, textColor=grey, spaceBefore=4, spaceAfter=6)))
    story.append(Paragraph(log['description'], sty('body', fontName='Helvetica', fontSize=10, leading=16, textColor=colors.HexColor('#0f172a'), spaceAfter=14)))

# Details table
td = log.get('type_data', {}) or {}
officer = log.get('officer', {}) or {}
off_name = f"{officer.get('first_name','')} {officer.get('last_name','')}".strip()
sia = officer.get('sia_licence_number','')
rows = [
    ['ATTENDING OFFICER', off_name or 'Not recorded'],
    ['SIA LICENCE', sia or 'Not recorded'],
]
if td.get('police_reported'): rows.append(['POLICE NOTIFIED', 'Yes' + (f' — {td.get("police_force","")}' if td.get('police_force') else '') + (f' Ref: {td.get("police_incident_number","")}' if td.get('police_incident_number') else '')])
if td.get('police_attended'): rows.append(['POLICE ATTENDED', f'Yes — {td.get("police_officer_name","")} {td.get("police_shoulder_number","")}'])
if log.get('latitude'): rows.append(['GPS LOCATION', f'{round(float(log["latitude"]),5)}, {round(float(log["longitude"]),5)}'])
if log.get('client_reportable'): rows.append(['CLIENT NOTIFICATION', 'SENT TO CLIENT'])

story.append(Paragraph('INCIDENT DETAILS', sty('sh2', fontName='Helvetica-Bold', fontSize=8, textColor=grey, spaceAfter=6)))
t = Table([[Paragraph(f'<b>{r[0]}</b>', sty('k', fontName='Helvetica-Bold', fontSize=9, textColor=grey)), 
            Paragraph(r[1], sty('v', fontName='Helvetica', fontSize=9, textColor=colors.HexColor('#0f172a')))] for r in rows],
    colWidths=['35%','65%'],
    style=[('BACKGROUND',(0,0),(-1,-1),lt),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
           ('LEFTPADDING',(0,0),(-1,-1),10),('LINEBELOW',(0,0),(-1,-2),0.5,colors.HexColor('#e2e8f0'))])
story.append(t)

# Footer
story.append(Spacer(1, 1*cm))
story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e2e8f0')))
story.append(Spacer(1, 0.3*cm))
story.append(Paragraph(
    f'Generated by DOB Live · {company} · {datetime.datetime.now().strftime("%d %b %Y %H:%M")}',
    sty('ft', fontName='Helvetica', fontSize=7, textColor=grey, alignment=1)))

doc.build(story)
print('OK')
`;

    const pyFile = `/tmp/gen_${Date.now()}.py`;
    fs.writeFileSync(pyFile, py);

    try {
      execSync(`python3 "${pyFile}" '${JSON.stringify(log).replace(/'/g, "'\\''")}' '${company?.name || 'DOB Live'}' '${tmpFile}'`, { timeout: 30000 });
      const pdfBuffer = fs.readFileSync(tmpFile);
      const base64 = pdfBuffer.toString('base64');
      fs.unlinkSync(tmpFile);
      fs.unlinkSync(pyFile);
      res.json({ pdf: base64, filename: `incident-report-${log_id.slice(0,8)}.pdf` });
    } catch (pyErr) {
      console.error('PDF gen error:', pyErr.message);
      res.status(500).json({ error: 'PDF generation failed: ' + pyErr.message });
    }
  } catch (err) { next(err); }
});

module.exports = router;
