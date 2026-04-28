const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

const ESCALATION_PHONE = process.env.ESCALATION_PHONE_1 || '+447587865219';

function getTwilio() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  return require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// POST /api/escalation/check-call — officer makes a check call with PIN
router.post('/check-call', authenticate, async (req, res, next) => {
  try {
    const { pin, lat, lng } = req.body;
    if (!pin) return res.status(400).json({ error: 'PIN required' });

    const officer = req.user;
    const isDuress = pin === officer.duress_pin;
    const isSafe = pin === officer.safe_pin;

    if (!isSafe && !isDuress) {
      return res.status(403).json({ error: 'Invalid PIN' });
    }

    // Always log as OK (even duress — so attacker sees normal response)
    await supabase.from('occurrence_logs').insert({
      company_id: officer.company_id,
      site_id: req.body.site_id || null,
      shift_id: req.body.shift_id || null,
      officer_id: officer.id,
      log_type: 'WELFARE_CHECK',
      title: `✓ Safety Check — ${officer.first_name} ${officer.last_name}`,
      description: `Officer safety check at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}. All OK.`,
      occurred_at: new Date().toISOString(),
      latitude: lat || null, longitude: lng || null,
      type_data: { check_call: true, duress: isDuress },
    });

    // If duress — silently trigger escalation
    if (isDuress) {
      await triggerEscalation(officer, req.body.site_id, 'DURESS', `DURESS PIN entered by ${officer.first_name} ${officer.last_name}`);
    }

    // Always respond OK (officer sees normal confirmation)
    res.json({ success: true, message: 'Check call logged' });
  } catch (err) { next(err); }
});

// POST /api/escalation/panic — immediate panic button
router.post('/panic', authenticate, async (req, res, next) => {
  try {
    const officer = req.user;
    const { lat, lng, site_id, shift_id } = req.body;

    await supabase.from('occurrence_logs').insert({
      company_id: officer.company_id,
      site_id: site_id || null,
      shift_id: shift_id || null,
      officer_id: officer.id,
      log_type: 'EMERGENCY',
      title: `🚨 PANIC — ${officer.first_name} ${officer.last_name}`,
      description: `Officer activated panic button.`,
      occurred_at: new Date().toISOString(),
      latitude: lat || null, longitude: lng || null,
      type_data: { panic: true },
    });

    await triggerEscalation(officer, site_id, 'PANIC', `PANIC BUTTON activated by ${officer.first_name} ${officer.last_name}`);

    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/escalation/missed-check — called by cron or frontend when check call overdue
router.post('/missed-check', authenticate, async (req, res, next) => {
  try {
    const officer = req.user;
    const { site_id, shift_id, minutes_overdue } = req.body;

    await supabase.from('occurrence_logs').insert({
      company_id: officer.company_id,
      site_id: site_id || null,
      shift_id: shift_id || null,
      officer_id: officer.id,
      log_type: 'WELFARE_CHECK',
      title: `⚠ Missed Safety Check — ${officer.first_name} ${officer.last_name}`,
      description: `Officer safety check overdue by ${minutes_overdue || '?'} minutes.`,
      occurred_at: new Date().toISOString(),
      type_data: { missed_check: true, minutes_overdue },
    });

    // SMS to officer
    const twilio = getTwilio();
    if (twilio && officer.phone) {
      try {
        await twilio.messages.create({
          body: `DOB Live: Your check call is overdue. Please open the app and make your check call immediately.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: officer.phone.startsWith('+') ? officer.phone : `+44${officer.phone.replace(/^0/, '')}`,
        });
      } catch (e) { console.error('SMS to officer failed:', e.message); }
    }

    // If 20+ mins overdue, auto-dial escalation
    if ((minutes_overdue || 0) >= 20) {
      await triggerEscalation(officer, site_id, 'MISSED_CHECK', `Check call overdue ${minutes_overdue} mins — ${officer.first_name} ${officer.last_name}`);
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/escalation/pins — officer gets their own PINs
router.get('/pins', authenticate, async (req, res, next) => {
  try {
    res.json({ safe_pin: req.user.safe_pin || null, duress_pin: req.user.duress_pin || null });
  } catch (err) { next(err); }
});

// PATCH /api/escalation/pins — officer sets their PINs
router.patch('/pins', authenticate, async (req, res, next) => {
  try {
    const { safe_pin, duress_pin } = req.body;
    if (safe_pin === duress_pin) return res.status(400).json({ error: 'Safe and duress PINs must be different' });
    const updates = {};
    if (safe_pin !== undefined) updates.safe_pin = safe_pin;
    if (duress_pin !== undefined) updates.duress_pin = duress_pin;
    await supabase.from('users').update(updates).eq('id', req.user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Escalation helper ───────────────────────────────────────────────────────
async function triggerEscalation(officer, siteId, type, message) {
  const twilio = getTwilio();
  if (!twilio) { console.error('Twilio not configured'); return; }

  // Get site name
  let siteName = 'Unknown site';
  if (siteId) {
    const { data: site } = await supabase.from('sites').select('name, escalation_phone').eq('id', siteId).single();
    if (site) siteName = site.name;
  }

  const fullMessage = `${message} at ${siteName}`;

  // SMS to escalation number
  try {
    await twilio.messages.create({
      body: `DOB Live ALERT: ${fullMessage}. Immediate action required.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: ESCALATION_PHONE,
    });
    console.log(`Escalation SMS sent: ${fullMessage}`);
  } catch (e) { console.error('Escalation SMS failed:', e.message); }

  // Auto-dial escalation number with voice message
  try {
    await twilio.calls.create({
      twiml: `<Response><Say voice="alice" language="en-GB">DOB Live emergency alert. ${fullMessage}. Please respond immediately. Repeating. ${fullMessage}.</Say></Response>`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: ESCALATION_PHONE,
    });
    console.log(`Escalation call initiated: ${fullMessage}`);
  } catch (e) { console.error('Escalation call failed:', e.message); }
}

module.exports = router;
