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
      await triggerEscalation(officer, req.body.site_id, 'DURESS', `DURESS PIN entered by ${officer.first_name} ${officer.last_name}`, lat, lng);
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

    await triggerEscalation(officer, site_id, 'PANIC', `PANIC BUTTON activated by ${officer.first_name} ${officer.last_name}`, lat, lng);

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

// ── What3Words lookup ────────────────────────────────────────────────────────
async function getW3W(lat, lng) {
  if (!lat || !lng) return null;
  const key = process.env.W3W_API_KEY || process.env.VITE_W3W_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://api.what3words.com/v3/convert-to-3wa?coordinates=${lat}%2C${lng}&language=en&format=json&key=${key}`);
    const data = await res.json();
    return data.words || null;
  } catch { return null; }
}

// ── Escalation helper ───────────────────────────────────────────────────────
async function triggerEscalation(officer, siteId, type, message, lat, lng) {
  const twilio = getTwilio();
  if (!twilio) { console.error('Twilio not configured'); return; }

  // Get site name
  let siteName = 'Unknown site';
  if (siteId) {
    const { data: site } = await supabase.from('sites').select('name, escalation_phone').eq('id', siteId).single();
    if (site) siteName = site.name;
  }

  // Get What3Words location
  const w3w = await getW3W(lat, lng);
  const locationInfo = w3w ? `Location: what 3 words: ${w3w.replace(/\./g, ', ')}` : (lat ? `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}` : '');

  const fullMessage = `${message} at ${siteName}`;
  const smsLocation = w3w ? `Location: ///${w3w}` : (lat ? `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}` : '');

  // SMS to escalation number
  try {
    await twilio.messages.create({
      body: `Risk Secured NCC ALERT: ${fullMessage}. ${smsLocation}. Immediate action required.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: ESCALATION_PHONE,
    });
    console.log(`Escalation SMS sent: ${fullMessage}`);
  } catch (e) { console.error('Escalation SMS failed:', e.message); }

  // Auto-dial escalation number with voice message
  try {
    await twilio.calls.create({
      twiml: `<Response><Say voice="Polly.Amy" language="en-GB">This is Risk Secured emergency national command centre. ${fullMessage}. ${locationInfo}. Immediate welfare check required. Repeating. ${fullMessage}. ${locationInfo}.</Say></Response>`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: ESCALATION_PHONE,
    });
    console.log(`Escalation call initiated: ${fullMessage}`);
  } catch (e) { console.error('Escalation call failed:', e.message); }
}

// POST /api/escalation/cron-check — called by cron every 5 mins, checks all active shifts
router.post('/cron-check', async (req, res) => {
  try {
    // No auth required — this endpoint only reads shifts and triggers alerts

    const twilio = getTwilio();
    const now = new Date();
    const results = { checked: 0, alerts: 0 };

    // Get all active shifts with officer details
    const { data: activeShifts } = await supabase
      .from('shifts')
      .select('*, officer:users!shifts_officer_id_fkey(id, first_name, last_name, phone, company_id), site:sites(id, name)')
      .eq('status', 'ACTIVE');

    if (!activeShifts || activeShifts.length === 0) return res.json({ ...results, message: 'No active shifts' });

    for (const shift of activeShifts) {
      if (!shift.officer) continue;
      results.checked++;

      // Find last ACTUAL safety check (not missed check alerts) for this officer today
      const { data: lastCheck } = await supabase
        .from('occurrence_logs')
        .select('occurred_at, type_data')
        .eq('officer_id', shift.officer.id)
        .eq('log_type', 'WELFARE_CHECK')
        .gte('occurred_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())
        .order('occurred_at', { ascending: false })
        .limit(10);
      const actualCheck = (lastCheck || []).find(l => l.type_data?.check_call === true && !l.type_data?.missed_check);

      const lastTime = actualCheck ? new Date(actualCheck.occurred_at) : new Date(shift.checked_in_at || shift.start_time);
      const minsOverdue = Math.floor((now - lastTime) / 60000) - 60; // mins past the 1hr mark

      if (minsOverdue < 5) continue; // Not overdue yet

      const officerName = `${shift.officer.first_name} ${shift.officer.last_name}`;
      const siteName = shift.site?.name || 'Unknown site';
      const officerPhone = shift.officer.phone ? (shift.officer.phone.startsWith('+') ? shift.officer.phone : `+44${shift.officer.phone.replace(/^0/, '')}`) : null;

      // Check if we already escalated recently (prevent spam)
      const { data: recentAlert } = await supabase
        .from('occurrence_logs')
        .select('occurred_at')
        .eq('officer_id', shift.officer.id)
        .gte('occurred_at', new Date(now - 300000).toISOString()) // last 5 mins
        .eq('log_type', 'WELFARE_CHECK')
        .maybeSingle();
      if (recentAlert) continue; // Already handled in last 5 mins

      results.alerts++;

      // Always SMS the officer first
      if (twilio && officerPhone) {
        try {
          await twilio.messages.create({
            body: `Risk Secured NCC: Your safety check is ${minsOverdue} mins overdue. Please open the DOB Live app and complete your safety check immediately.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: officerPhone,
          });
          console.log(`Safety SMS sent to ${officerName}`);
        } catch (e) { console.error(`SMS to officer failed: ${e.message}`); }
      }

      // Always call the officer
      if (twilio && officerPhone) {
        try {
          await twilio.calls.create({
            twiml: `<Response><Say voice="Polly.Amy" language="en-GB">This is Risk Secured national command centre. Your safety check is ${minsOverdue} minutes overdue. Please open the DOB Live app and complete your safety check immediately.</Say></Response>`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: officerPhone,
          });
          console.log(`Safety call to ${officerName}`);
        } catch (e) { console.error(`Call to officer failed: ${e.message}`); }
      }

      // After 15 mins overdue — ALSO escalate to manager
      if (minsOverdue >= 15) {
        // Log missed check
        await supabase.from('occurrence_logs').insert({
          company_id: shift.officer.company_id,
          site_id: shift.site_id, shift_id: shift.id,
          officer_id: shift.officer.id, log_type: 'WELFARE_CHECK',
          title: `⚠ Missed Safety Check — ${officerName}`,
          description: `Officer safety check overdue by ${minsOverdue} minutes. Escalated to control.`,
          occurred_at: now.toISOString(),
          type_data: { missed_check: true, minutes_overdue: minsOverdue, auto_escalated: true },
        });

        // Escalate — call + SMS to manager
        if (twilio) {
          try {
            await twilio.messages.create({
              body: `Risk Secured NCC ALERT: ${officerName} at ${siteName} has failed safety check. ${minsOverdue} mins overdue. 3 contact attempts failed. Immediate welfare check required.`,
              from: process.env.TWILIO_PHONE_NUMBER,
              to: ESCALATION_PHONE,
            });
          } catch (e) { console.error(`Escalation SMS failed: ${e.message}`); }
          try {
            await twilio.calls.create({
              twiml: `<Response><Say voice="Polly.Amy" language="en-GB">This is Risk Secured emergency national command centre. Officer ${officerName} at ${siteName} has failed to make their scheduled safety check. ${minsOverdue} minutes overdue. Three contact attempts have failed. Immediate welfare check required. Repeating. Officer ${officerName} at ${siteName}. Safety check overdue. Immediate action required.</Say></Response>`,
              from: process.env.TWILIO_PHONE_NUMBER,
              to: ESCALATION_PHONE,
            });
          } catch (e) { console.error(`Escalation call failed: ${e.message}`); }
        }
      }
    }

    res.json(results);
  } catch (err) { console.error('Cron check error:', err); res.status(500).json({ error: err.message }); }
});

// POST /api/escalation/test — temporary test endpoint
router.post('/test', async (req, res) => {
  try {
    const twilio = getTwilio();
    if (!twilio) return res.status(500).json({ error: 'Twilio not configured', sid: process.env.TWILIO_ACCOUNT_SID ? 'SID set' : 'SID missing', phone: process.env.TWILIO_PHONE_NUMBER || 'missing' });

    const results = {};

    // Test SMS
    try {
      const sms = await twilio.messages.create({
        body: 'Risk Secured NCC TEST: Officer David Foster at Test Site has failed to make their scheduled safety check. Immediate welfare check required.',
        from: process.env.TWILIO_PHONE_NUMBER,
        to: ESCALATION_PHONE,
      });
      results.sms = { success: true, sid: sms.sid };
    } catch (e) { results.sms = { error: e.message }; }

    // Test call
    try {
      const call = await twilio.calls.create({
        twiml: '<Response><Say voice="Polly.Amy" language="en-GB">This is Risk Secured emergency national command centre. Officer David Foster at Test Site has failed to make their scheduled safety check. Immediate welfare check required.</Say></Response>',
        from: process.env.TWILIO_PHONE_NUMBER,
        to: ESCALATION_PHONE,
      });
      results.call = { success: true, sid: call.sid };
    } catch (e) { results.call = { error: e.message }; }

    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
