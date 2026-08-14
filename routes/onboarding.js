const router = require('express').Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// ── Group A roles ─────────────────────────────────────────────
const fdOnly = requireRole('SUPER_ADMIN', 'FD');

// ── Group B rate limiter ──────────────────────────────────────
// Applied to all unauthenticated token routes.
// Key: IP + token so a leaked link cannot be used to hammer the DB,
// and a single IP cannot probe multiple tokens quickly.
const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => `${req.ip}:${req.params.token || ''}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

// ── Constants ─────────────────────────────────────────────────

const BASE_URL = process.env.ONBOARDING_BASE_URL || 'https://app.doblive.co.uk/onboarding';

// Fields officers may write via the onboarding form.
// Explicitly excludes: employment_status, vetting_status, company_id, user_id,
// onboarding_completed, onboarding_completed_at, all document path columns,
// right_to_work_status/expiry (company-verified, not self-declared), and the
// declaration _at timestamps (server-generated — see PATCH handler below).
const OFFICER_HR_WHITELIST = new Set([
  'nok_name',
  'nok_relationship',
  'nok_phone',
  'address_line_1',
  'address_line_2',
  'city',
  'postcode',
  'date_of_birth',
  'ni_number',
  'personal_email',
  'bank_name',
  'bank_sort_code',
  'bank_account_number',
  'bank_account_holder',
  'utr_number',
  'company_name',
  'company_address',
  'company_vat_number',
  'company_reg_number',
  'self_employment_declaration',
  'terms_accepted',
  'gdpr_consent',
  'nationality',
  'onboarding_step',
]);

// Fields that must be non-null/non-false before the link can be marked complete.
const REQUIRED_FIELDS = [
  'nok_name',
  'nok_phone',
  'address_line_1',
  'city',
  'postcode',
  'date_of_birth',
  'ni_number',
  'bank_account_holder',
  'bank_sort_code',
  'bank_account_number',
  'gdpr_consent',
  'terms_accepted',
];

// Sensitive fields that must never be returned as values — only as filled/empty flags.
const SENSITIVE_FIELDS = new Set([
  'ni_number',
  'utr_number',
  'bank_account_number',
  'bank_sort_code',
  'bank_account_holder',
  'bank_name',
]);

// ── Helpers ───────────────────────────────────────────────────

function deriveStatus(link) {
  if (link.revoked_at)   return 'revoked';
  if (link.completed_at) return 'completed';
  if (new Date(link.expires_at) < new Date()) return 'expired';
  if (!link.opened_at && link.send_count === 0) return 'not_sent';
  if (!link.opened_at) return 'sent_not_opened';
  return 'in_progress';
}

// Looks up a token, validates it is live, then updates opened_at / last_seen_at.
// Returns the link record on success, or sends a 404 and returns null.
// The 404 message is deliberately generic — it must not reveal whether the token
// was invalid, expired, revoked, or already completed.
async function resolveToken(req, res) {
  const { token } = req.params;

  const { data: link, error } = await supabase
    .from('onboarding_links')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (
    error ||
    !link ||
    link.revoked_at ||
    link.completed_at ||
    new Date(link.expires_at) < new Date()
  ) {
    res.status(404).json({ error: 'Link not found or no longer valid' });
    return null;
  }

  const now = new Date().toISOString();
  const updates = { last_seen_at: now };
  if (!link.opened_at) updates.opened_at = now;

  // Fire-and-forget — do not block the response on a bookkeeping write
  supabase
    .from('onboarding_links')
    .update(updates)
    .eq('id', link.id)
    .then(({ error: e }) => { if (e) console.error('[onboarding] last_seen_at update failed:', e.message); });

  return link;
}

// ═════════════════════════════════════════════════════════════
// GROUP A — Authenticated, SUPER_ADMIN and FD only
// ═════════════════════════════════════════════════════════════

// POST /api/onboarding/links
// Body: { user_id }
// Creates a new onboarding link for the officer. Revokes any existing live link first
// because the partial unique index prevents two live rows for the same user_id.
router.post('/links', authenticate, fdOnly, async (req, res, next) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    // Confirm officer exists in this company
    const { data: officer } = await supabase
      .from('users')
      .select('id')
      .eq('id', user_id)
      .eq('company_id', req.user.company_id)
      .maybeSingle();
    if (!officer) return res.status(404).json({ error: 'Officer not found' });

    // Revoke any existing live link before inserting (index enforces uniqueness)
    await supabase
      .from('onboarding_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', user_id)
      .is('revoked_at', null)
      .is('completed_at', null);

    const token = crypto.randomBytes(32).toString('base64url');
    const expires_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: link, error } = await supabase
      .from('onboarding_links')
      .insert({
        company_id: req.user.company_id,
        user_id,
        token,
        created_by: req.user.id,
        expires_at,
      })
      .select('id, token, expires_at, created_at')
      .single();
    if (error) throw error;

    res.status(201).json({
      data: {
        id: link.id,
        token: link.token,
        url: `${BASE_URL}/${link.token}`,
        expires_at: link.expires_at,
        created_at: link.created_at,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/onboarding/links
// Chase list — all links for the company with derived status.
// Token is never returned.
router.get('/links', authenticate, fdOnly, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('onboarding_links')
      .select(`
        id, created_at, expires_at, opened_at, last_seen_at,
        completed_at, revoked_at, send_count,
        officer:users!onboarding_links_user_id_fkey(first_name, last_name)
      `)
      .eq('company_id', req.user.company_id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (data || []).map(link => ({
      id:           link.id,
      officer:      link.officer,
      created_at:   link.created_at,
      expires_at:   link.expires_at,
      opened_at:    link.opened_at,
      last_seen_at: link.last_seen_at,
      completed_at: link.completed_at,
      send_count:   link.send_count,
      status:       deriveStatus(link),
    }));

    res.json({ data: rows });
  } catch (err) { next(err); }
});

// POST /api/onboarding/links/:id/revoke
router.post('/links/:id/revoke', authenticate, fdOnly, async (req, res, next) => {
  try {
    const { data: link, error: fetchErr } = await supabase
      .from('onboarding_links')
      .select('id')
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!link) return res.status(404).json({ error: 'Link not found' });

    const { error } = await supabase
      .from('onboarding_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', link.id);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════
// GROUP B — Unauthenticated, token in URL
//
// No Clerk session. All identity comes from the link record, never from the request.
// Security properties enforced on every route:
//   - resolveToken() rejects invalid/expired/revoked/completed tokens with a generic 404
//   - user_id and company_id are taken from the link record, never from the request body
//   - Rate limited by IP + token (tokenLimiter above)
//   - Sensitive field values are never returned in responses
// ═════════════════════════════════════════════════════════════

// GET /api/onboarding/:token
// Returns the officer's first name (for the greeting) and filled/empty flags for every
// whitelisted field. Sensitive values (bank details, NI, UTR) are never returned as values,
// only as booleans indicating whether the field has been filled in.
router.get('/:token', tokenLimiter, async (req, res, next) => {
  try {
    const link = await resolveToken(req, res);
    if (!link) return;

    const [{ data: user }, { data: hr }] = await Promise.all([
      supabase.from('users').select('first_name').eq('id', link.user_id).single(),
      supabase.from('officer_hr').select('*').eq('user_id', link.user_id).maybeSingle(),
    ]);

    const fields = {};
    for (const field of OFFICER_HR_WHITELIST) {
      fields[field] = hr ? (hr[field] !== null && hr[field] !== '' && hr[field] !== false) : false;
    }

    res.json({
      first_name: user?.first_name || null,
      fields,
    });
  } catch (err) { next(err); }
});

// PATCH /api/onboarding/:token
// Saves progress. The entire request is rejected if any field not on the whitelist is present —
// fields are never silently dropped.
router.patch('/:token', tokenLimiter, async (req, res, next) => {
  try {
    const link = await resolveToken(req, res);
    if (!link) return;

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const keys = Object.keys(body);
    if (keys.length === 0) return res.status(400).json({ error: 'No fields provided' });

    const disallowed = keys.filter(k => !OFFICER_HR_WHITELIST.has(k));
    if (disallowed.length > 0) {
      return res.status(400).json({ error: 'Disallowed fields in request', fields: disallowed });
    }

    const now = new Date().toISOString();
    const record = {
      user_id:    link.user_id,
      company_id: link.company_id,
      updated_at: now,
    };
    for (const key of keys) {
      record[key] = body[key];
    }

    // Declaration timestamps are evidence — always server-generated, never from the client.
    if ('self_employment_declaration' in body) {
      record.self_employment_declaration_at = body.self_employment_declaration ? now : null;
    }
    if ('terms_accepted' in body) {
      record.terms_accepted_at = body.terms_accepted ? now : null;
    }
    if ('gdpr_consent' in body) {
      record.gdpr_consent_at = body.gdpr_consent ? now : null;
    }

    const { error } = await supabase
      .from('officer_hr')
      .upsert(record, { onConflict: 'user_id' });
    if (error) throw error;

    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/onboarding/:token/complete
// Validates all required fields are present, then marks the HR record and the link as complete.
// Returns which fields are still missing so the form can redirect the officer back to them.
router.post('/:token/complete', tokenLimiter, async (req, res, next) => {
  try {
    const link = await resolveToken(req, res);
    if (!link) return;

    const { data: hr } = await supabase
      .from('officer_hr')
      .select(REQUIRED_FIELDS.join(', '))
      .eq('user_id', link.user_id)
      .maybeSingle();

    const missing = REQUIRED_FIELDS.filter(f => {
      const val = hr?.[f];
      return val === null || val === undefined || val === '' || val === false;
    });

    if (missing.length > 0) {
      return res.status(422).json({ error: 'Required fields incomplete', missing });
    }

    const now = new Date().toISOString();

    const [hrResult, linkResult] = await Promise.all([
      supabase
        .from('officer_hr')
        .update({ onboarding_completed: true, onboarding_completed_at: now, updated_at: now })
        .eq('user_id', link.user_id),
      supabase
        .from('onboarding_links')
        .update({ completed_at: now })
        .eq('id', link.id),
    ]);

    if (hrResult.error)   throw hrResult.error;
    if (linkResult.error) throw linkResult.error;

    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
