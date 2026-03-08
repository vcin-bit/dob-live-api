const https = require('https');

const FROM = process.env.SENDGRID_FROM || 'onboarding@doblive.co.uk';
const APP_URL = process.env.FRONTEND_URL || 'https://app.doblive.co.uk';

async function send(to, subject, html) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[EMAIL - no SendGrid key] To: ${to} | Subject: ${subject}`);
    return;
  }
  const payload = JSON.stringify({
    personalizations: [{ to: [{ email: to }] }],
    from: { email: FROM },
    subject,
    content: [{ type: 'text/html', value: html }]
  });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.eu.sendgrid.com',
      path: '/v3/mail/send',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`[EMAIL SENT] To: ${to} | Subject: ${subject}`);
      } else {
        console.error(`[EMAIL FAILED] To: ${to} | HTTP ${res.statusCode}`);
      }
      resolve();
    });
    req.on('error', (err) => {
      console.error(`[EMAIL FAILED] To: ${to} | ${err.message}`);
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

// ── Company onboarding ──────────────────────────────────────────────────────
exports.sendCompanyWelcome = async ({ companyName, tier, managerName, managerEmail, managerPassword }) => {
  const subject = `Welcome to DOB·LIVE — Your account is ready`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
      <div style="background:#0f2744;padding:24px 32px;border-radius:8px 8px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:22px;">DOB·LIVE</h1>
        <p style="color:#93c5fd;margin:4px 0 0;font-size:13px;">Digital Occurrence Book</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        <p style="font-size:16px;">Hello ${managerName},</p>
        <p>Your <strong>DOB·LIVE</strong> account for <strong>${companyName}</strong> has been created and is ready to use.</p>

        <div style="background:#f0f4f8;border-radius:8px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 12px;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Your Login Details</p>
          <table style="width:100%;font-size:14px;">
            <tr><td style="padding:4px 0;color:#64748b;width:120px;">Login URL</td><td><a href="${APP_URL}/login.html" style="color:#1d4ed8;">${APP_URL}/login.html</a></td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Email</td><td><strong>${managerEmail}</strong></td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Password</td><td><strong>${managerPassword}</strong></td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Plan</td><td style="text-transform:capitalize;">${tier}</td></tr>
          </table>
        </div>

        <p style="font-weight:700;">Getting started:</p>
        <ol style="font-size:14px;line-height:1.8;color:#334155;">
          <li>Log in at the URL above and change your password</li>
          <li>Add your sites under <strong>Site Management</strong></li>
          <li>Add your officers and assign them to sites</li>
          <li>Share the officer app link with your team: <a href="${APP_URL}/officer-dob-page.html">${APP_URL}/officer-dob-page.html</a></li>
        </ol>

        <p style="font-size:13px;color:#64748b;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">
          If you have any questions please reply to this email.<br/>
          DOB·LIVE · PSIN Group Ltd
        </p>
      </div>
    </div>`;
  await send(managerEmail, subject, html);
};

// ── Officer welcome ─────────────────────────────────────────────────────────
exports.sendOfficerWelcome = async ({ officerName, companyName, email, password, sites }) => {
  const siteList = sites?.length ? sites.map(s => s.name || s).join(', ') : null;
  const subject = `Welcome to DOB·LIVE — ${companyName}`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
      <div style="background:#0f2744;padding:24px 32px;border-radius:8px 8px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:22px;">DOB·LIVE</h1>
        <p style="color:#93c5fd;margin:4px 0 0;font-size:13px;">Digital Occurrence Book — Officer App</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        <p style="font-size:16px;">Hello ${officerName},</p>
        <p>You've been added to <strong>${companyName}</strong> on DOB·LIVE. Use the details below to log in to your officer app.</p>

        <div style="background:#f0f4f8;border-radius:8px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 12px;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Your Login Details</p>
          <table style="width:100%;font-size:14px;">
            <tr><td style="padding:4px 0;color:#64748b;width:120px;">App URL</td><td><a href="${APP_URL}/officer-dob-page.html" style="color:#1d4ed8;">${APP_URL}/officer-dob-page.html</a></td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Email</td><td><strong>${email}</strong></td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Password</td><td><strong>${password}</strong></td></tr>
            ${siteList ? `<tr><td style="padding:4px 0;color:#64748b;">Assigned to</td><td>${siteList}</td></tr>` : ''}
          </table>
        </div>

        <p style="font-weight:700;">When you arrive on site:</p>
        <ol style="font-size:14px;line-height:1.8;color:#334155;">
          <li>Open the app URL above on your phone</li>
          <li>Log in with your email and password</li>
          <li>Select your site when prompted</li>
          <li>Tap <strong>On Duty</strong> to start your shift</li>
        </ol>

        <p style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;font-size:13px;color:#991b1b;">
          Please change your password after first login and do not share your credentials.
        </p>

        <p style="font-size:13px;color:#64748b;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">
          DOB·LIVE · ${companyName}
        </p>
      </div>
    </div>`;
  await send(email, subject, html);
};

// ── Manager password reset (existing reset flow) ────────────────────────────
exports.sendPasswordReset = async ({ name, email, resetUrl }) => {
  const subject = 'DOB·LIVE — Password Reset Request';
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0f2744;padding:24px 32px;border-radius:8px 8px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:22px;">DOB·LIVE</h1>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        <p>Hello ${name},</p>
        <p>A password reset was requested for your DOB·LIVE account.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#0f2744;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;">Reset My Password</a></p>
        <p style="font-size:13px;color:#64748b;">This link expires in 1 hour. If you did not request this, ignore this email.</p>
      </div>
    </div>`;
  await send(email, subject, html);
};
