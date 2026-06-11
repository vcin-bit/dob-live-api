const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

const HR_ROLES = ['SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'];

// ── GET /api/personnel/:userId — full personnel file for an officer ──────────
router.get('/:userId', authenticate, requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const companyId = req.user.company_id;

    const [userRes, hrRes, empRes, addrRes, notesRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).eq('company_id', companyId).single(),
      supabase.from('officer_hr').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('employment_history').select('*').eq('user_id', userId).eq('company_id', companyId).order('start_date', { ascending: false }),
      supabase.from('address_history').select('*').eq('user_id', userId).eq('company_id', companyId).order('start_date', { ascending: false }),
      supabase.from('hr_notes').select('*, author:author_id(first_name, last_name)').eq('user_id', userId).eq('company_id', companyId).order('created_at', { ascending: false }),
    ]);

    if (userRes.error || !userRes.data) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: userRes.data,
      hr: hrRes.data || null,
      employment_history: empRes.data || [],
      address_history: addrRes.data || [],
      notes: notesRes.data || [],
    });
  } catch (err) { next(err); }
});

// ── Employment History ───────────────────────────────────────────────────────
router.post('/:userId/employment', authenticate, async (req, res, next) => {
  try {
    const isHR = HR_ROLES.includes(req.user.role);
    const userId = isHR ? req.params.userId : req.user.id;
    const { employer_name, job_title, start_date, end_date, is_current, reason_for_leaving } = req.body;
    if (!employer_name || !start_date) return res.status(400).json({ error: 'Employer name and start date required' });
    const { data, error } = await supabase.from('employment_history')
      .insert({ user_id: userId, company_id: req.user.company_id, employer_name, job_title, start_date, end_date: is_current ? null : end_date, is_current, reason_for_leaving })
      .select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.patch('/:userId/employment/:id', authenticate, async (req, res, next) => {
  try {
    const allowed = ['employer_name','job_title','start_date','end_date','is_current','reason_for_leaving'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase.from('employment_history').update(updates).eq('id', req.params.id).eq('company_id', req.user.company_id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:userId/employment/:id', authenticate, async (req, res, next) => {
  try {
    await supabase.from('employment_history').delete().eq('id', req.params.id).eq('company_id', req.user.company_id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Address History ──────────────────────────────────────────────────────────
router.post('/:userId/address', authenticate, async (req, res, next) => {
  try {
    const isHR = HR_ROLES.includes(req.user.role);
    const userId = isHR ? req.params.userId : req.user.id;
    const { address_line_1, address_line_2, city, postcode, start_date, end_date, is_current } = req.body;
    if (!address_line_1 || !start_date) return res.status(400).json({ error: 'Address and start date required' });
    const { data, error } = await supabase.from('address_history')
      .insert({ user_id: userId, company_id: req.user.company_id, address_line_1, address_line_2, city, postcode, start_date, end_date: is_current ? null : end_date, is_current })
      .select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.delete('/:userId/address/:id', authenticate, async (req, res, next) => {
  try {
    await supabase.from('address_history').delete().eq('id', req.params.id).eq('company_id', req.user.company_id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── HR Notes ─────────────────────────────────────────────────────────────────
router.post('/:userId/notes', authenticate, requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Note content required' });
    const { data, error } = await supabase.from('hr_notes')
      .insert({ user_id: req.params.userId, company_id: req.user.company_id, author_id: req.user.id, content: content.trim() })
      .select('*, author:author_id(first_name, last_name)').single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.delete('/:userId/notes/:id', authenticate, requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    await supabase.from('hr_notes').delete().eq('id', req.params.id).eq('company_id', req.user.company_id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Update HR record on behalf of officer ────────────────────────────────────
router.put('/:userId/hr', authenticate, requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const allowed = ['nok_name','nok_relationship','nok_phone','address_line_1','address_line_2','city','postcode',
      'date_of_birth','ni_number','personal_email','bank_name','bank_sort_code','bank_account_number','bank_account_holder',
      'employment_status','utr_number','company_name','company_address','company_vat_number','company_reg_number',
      'nationality','right_to_work_status','right_to_work_expiry','gdpr_consent','gdpr_consent_at',
      'self_employment_declaration','self_employment_declaration_at','terms_accepted','terms_accepted_at'];
    const record = { user_id: req.params.userId, company_id: req.user.company_id, updated_at: new Date().toISOString() };
    allowed.forEach(k => { if (req.body[k] !== undefined) record[k] = req.body[k] || null; });
    const { data, error } = await supabase.from('officer_hr')
      .upsert(record, { onConflict: 'user_id' }).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// ── Vetting Status Update ────────────────────────────────────────────────────
router.patch('/:userId/vetting-status', authenticate, requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const { vetting_status } = req.body;
    const { data, error } = await supabase.from('officer_hr')
      .update({ vetting_status }).eq('user_id', req.params.userId).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
