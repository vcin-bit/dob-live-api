// Shared notification helpers — SMS via Twilio, email via SendGrid.
// Both helpers swallow their own errors so callers never need to try/catch.

function getTwilio() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  return require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function getSg() {
  if (!process.env.SENDGRID_API_KEY) return null;
  const sg = require('@sendgrid/mail');
  sg.setApiKey(process.env.SENDGRID_API_KEY);
  return sg;
}

/**
 * Send an SMS message.
 * @param {{ to: string, body: string }} opts
 */
async function sendSms({ to, body }) {
  const twilio = getTwilio();
  if (!twilio) { console.error('[notifications] Twilio not configured — SMS skipped'); return; }
  try {
    await twilio.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER, to });
  } catch (e) {
    console.error('[notifications] SMS failed:', e.message);
  }
}

/**
 * Send an email via SendGrid.
 * @param {{ to: string, subject: string, html: string, from?: string, cc?: string, attachments?: any[] }} opts
 * @returns {Promise<boolean>} true if sent, false on error or misconfiguration
 */
async function sendEmail({ to, subject, html, from, cc, attachments }) {
  const sg = getSg();
  if (!sg) { console.error('[notifications] SendGrid not configured — email skipped'); return false; }
  const fromAddr = from || process.env.SENDGRID_FROM || 'noreply@doblive.co.uk';
  try {
    const msg = { to, from: fromAddr, subject, html };
    if (cc) msg.cc = cc;
    if (attachments) msg.attachments = attachments;
    await sg.send(msg);
    return true;
  } catch (e) {
    console.error('[notifications] Email failed:', e.message);
    return false;
  }
}

module.exports = { sendSms, sendEmail };
