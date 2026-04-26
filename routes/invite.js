const router   = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// Lazy-load SendGrid so server starts even without the key
function getSg() {
  if (!process.env.SENDGRID_API_KEY) return null;
  const sg = require('@sendgrid/mail');
  sg.setApiKey(process.env.SENDGRID_API_KEY);
  return sg;
}

const FROM = process.env.SENDGRID_FROM || 'noreply@doblive.co.uk';
const APP_URL = process.env.APP_URL || 'https://app.doblive.co.uk';

// POST /api/invite
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { email, first_name, last_name, role, sia_licence_number, sia_licence_type, sia_expiry_date, phone } = req.body;

    if (!email || !first_name) {
      return res.status(400).json({ error: 'Email and first name are required' });
    }

    const normalised = email.toLowerCase().trim();

    // Check not already a user
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalised)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    // Create the Supabase record (clerk_id null — linked on first sign-in)
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        company_id: req.user.company_id,
        clerk_id: null,
        role: role || 'OFFICER',
        first_name: first_name.trim(),
        last_name: (last_name || '').trim(),
        email: normalised,
        phone: phone || null,
        sia_licence_number: sia_licence_number || null,
        sia_licence_type:   sia_licence_type   || null,
        sia_expiry_date: sia_expiry_date || null,
        active: true,
      })
      .select()
      .single();

    if (error) throw error;

    // Send invite email
    const sg = getSg();
    let emailSent = false;

    if (sg) {
      const roleLabel = {
        OFFICER: 'Security Officer',
        OPS_MANAGER: 'Operations Manager',
        FD: 'Field Director',
        COMPANY: 'Administrator',
      }[role] || 'Team Member';

      try {
        await sg.send({
          to: normalised,
          from: FROM,
          subject: `You've been added to DOB Live`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:24px;">
              <div style="background:#0b1222;padding:20px 24px;border-radius:8px 8px 0 0;">
                <span style="font-size:1.25rem;font-weight:700;"><span style="color:#1a52a8;">DOB</span><span style="color:#fff;"> Live</span></span>
              </div>
              <div style="background:#ffffff;padding:28px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
                <p style="color:#0b1222;font-size:1rem;font-weight:600;margin:0 0 8px;">Hi ${first_name},</p>
                <p style="color:#475569;margin:0 0 20px;">Your DOB Live account has been created with <strong>${roleLabel}</strong> access.</p>
                <p style="color:#475569;margin:0 0 8px;">To get started:</p>
                <ol style="color:#475569;margin:0 0 24px;padding-left:20px;line-height:1.8;">
                  <li>Go to <a href="${APP_URL}" style="color:#1a52a8;">${APP_URL}</a></li>
                  <li>Click <strong>Create account</strong></li>
                  <li>Sign up using this email address: <strong>${normalised}</strong></li>
                </ol>
                <a href="${APP_URL}" style="display:inline-block;background:#1a52a8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.9375rem;">Access DOB Live</a>
                <p style="color:#94a3b8;font-size:0.8125rem;margin:24px 0 0;">If you were not expecting this invitation, you can ignore this email.</p>
              </div>
            </div>
          `,
        });
        emailSent = true;
      } catch (emailErr) {
        console.error('SendGrid error:', emailErr.message);
      }
    }

    res.status(201).json({
      data: user,
      email_sent: emailSent,
      message: emailSent
        ? `Invitation sent to ${normalised}`
        : `User created. Email not sent — check SENDGRID_API_KEY on Render.`,
    });

  } catch (err) { next(err); }
});

// POST /api/invite/resend
router.post('/resend', authenticate, requireRole('SUPER_ADMIN','COMPANY','OPS_MANAGER','FD'), async (req, res, next) => {
  try {
    const { user_id } = req.body;
    const { data: officer, error } = await supabase.from('users').select('*').eq('id', user_id).eq('company_id', req.user.company_id).single();
    if (error || !officer) return res.status(404).json({ error: 'Officer not found' });
    if (officer.clerk_id) return res.status(400).json({ error: 'Officer has already signed up' });
    const sg = getSg();
    let emailSent = false;
    if (sg) {
      try {
        await sg.send({
          to: officer.email,
          from: FROM,
          subject: 'Reminder: Your DOB Live invitation',
          html: `<p>Hi ${officer.first_name},</p><p>This is a reminder that you have been invited to DOB Live.</p><p><a href="${APP_URL}" style="background:#1a52a8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Sign Up Now</a></p><p>Please sign up using your email address: <strong>${officer.email}</strong></p>`,
        });
        emailSent = true;
      } catch (sgErr) {
        console.error('SendGrid error:', sgErr.message);
      }
    }
    res.json({ 
      success: true, 
      emailSent,
      message: emailSent 
        ? `Invite email sent to ${officer.email}` 
        : `No email sent — ask ${officer.first_name} to sign up at ${APP_URL} using ${officer.email}`
    });
  } catch (err) { next(err); }
});

module.exports = router;
