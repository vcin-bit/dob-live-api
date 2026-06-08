const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/id-cards/summary — company-wide card status counts
router.get('/summary', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('officer_id_cards')
      .select('id, status, expiry_date')
      .eq('company_id', req.user.company_id);
    if (error) throw error;
    const now = new Date().toISOString().split('T')[0];
    const soon = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const active = (data || []).filter(c => c.status === 'active');
    res.json({
      total: (data || []).length,
      active: active.length,
      expiring_soon: active.filter(c => c.expiry_date <= soon && c.expiry_date > now).length,
      expired: active.filter(c => c.expiry_date <= now).length,
      lost: (data || []).filter(c => c.status === 'lost').length,
      revoked: (data || []).filter(c => c.status === 'revoked').length,
      returned: (data || []).filter(c => c.status === 'returned').length,
    });
  } catch (err) { next(err); }
});

// GET /api/id-cards/company — all cards with officer details
router.get('/company', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('officer_id_cards')
      .select('*, officer:users!officer_id_cards_user_id_fkey(first_name, last_name, employee_number)')
      .eq('company_id', req.user.company_id)
      .order('expiry_date', { ascending: true });
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/id-cards/:userId — get cards for an officer
router.get('/:userId', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('officer_id_cards')
      .select('*, issued_by_user:users!officer_id_cards_issued_by_fkey(first_name, last_name)')
      .eq('company_id', req.user.company_id)
      .eq('user_id', req.params.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/id-cards — issue new card
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { user_id, expiry_date, notes } = req.body;
    if (!user_id || !expiry_date) return res.status(400).json({ error: 'user_id and expiry_date required' });

    // Generate card number
    const { data: latest } = await supabase.from('officer_id_cards').select('card_number').eq('company_id', req.user.company_id).order('created_at', { ascending: false }).limit(1);
    const lastNum = latest?.[0]?.card_number ? parseInt(latest[0].card_number.replace('RSC-', ''), 10) || 0 : 0;
    const cardNumber = `RSC-${String(lastNum + 1).padStart(4, '0')}`;

    const { data, error } = await supabase.from('officer_id_cards').insert({
      company_id: req.user.company_id,
      user_id,
      card_number: cardNumber,
      status: 'active',
      issue_date: new Date().toISOString().split('T')[0],
      expiry_date,
      issued_by: req.user.id,
      notes: notes || null,
    }).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PATCH /api/id-cards/:id — update card status
router.patch('/:id', authenticate, requireRole('SUPER_ADMIN', 'COMPANY', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { status, revocation_reason } = req.body;
    const allowed = ['active', 'lost', 'returned', 'revoked', 'expired'];
    if (!allowed.includes(status)) return res.status(400).json({ error: `Invalid status. Must be: ${allowed.join(', ')}` });

    const updates = { status, updated_at: new Date().toISOString() };
    if (status === 'revoked' || status === 'lost') {
      updates.revoked_by = req.user.id;
      updates.revoked_at = new Date().toISOString();
      updates.revocation_reason = revocation_reason || null;
    }
    const { data, error } = await supabase.from('officer_id_cards').update(updates).eq('id', req.params.id).eq('company_id', req.user.company_id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/id-cards/:id/pdf — generate printable card PDF
router.get('/:id/pdf', authenticate, async (req, res, next) => {
  try {
    const PDFDocument = require('pdfkit');
    const { data: card, error } = await supabase
      .from('officer_id_cards')
      .select('*, officer:users!officer_id_cards_user_id_fkey(first_name, last_name, employee_number, sia_licence_number, sia_licence_type, sia_expiry_date, role)')
      .eq('id', req.params.id)
      .eq('company_id', req.user.company_id)
      .single();
    if (error) { console.error('[IDCard PDF] Query error:', error.message); return res.status(500).json({ error: error.message }); }
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const { data: company } = await supabase.from('companies').select('name, logo_url').eq('id', req.user.company_id).single();

    // CR80 card size: 86mm × 54mm = 243.78 × 153.07 points
    const W = 244, H = 153;
    const doc = new PDFDocument({ size: [W, H], margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="ID-Card-${card.card_number}.pdf"`);
    doc.pipe(res);

    // Background
    doc.rect(0, 0, W, H).fill('#0b1a3e');

    // Top accent bar
    doc.rect(0, 0, W, 4).fill('#1a52a8');

    // Company name
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff')
      .text(company?.name || 'Risk Secured Ltd', 10, 10, { width: W - 20, align: 'center' });

    // Officer name
    const name = `${card.officer?.first_name || ''} ${card.officer?.last_name || ''}`.trim();
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#ffffff')
      .text(name, 10, 30, { width: W - 20, align: 'center' });

    // Role
    doc.fontSize(6).font('Helvetica').fillColor('#ffffff', 0.6)
      .text((card.officer?.role || 'OFFICER').replace('_', ' '), 10, 46, { width: W - 20, align: 'center' });

    // Divider
    doc.save().fillOpacity(0.2).rect(20, 55, W - 40, 0.5).fill('#ffffff').restore();

    // Details - left column
    const detY = 62;
    doc.fontSize(5).font('Helvetica').fillColor('#ffffff', 0.5);
    doc.text('CARD NUMBER', 10, detY);
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text(card.card_number, 10, detY + 7);

    doc.fontSize(5).font('Helvetica').fillColor('#ffffff', 0.5);
    doc.text('EMPLOYEE NO.', 10, detY + 20);
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text(card.officer?.employee_number || '—', 10, detY + 27);

    doc.fontSize(5).font('Helvetica').fillColor('#ffffff', 0.5);
    doc.text('SIA LICENCE', 10, detY + 40);
    doc.fontSize(6).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text(card.officer?.sia_licence_number || '—', 10, detY + 47);

    // Details - right column
    doc.fontSize(5).font('Helvetica').fillColor('#ffffff', 0.5);
    doc.text('ISSUED', W / 2 + 10, detY);
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text(new Date(card.issue_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), W / 2 + 10, detY + 7);

    doc.fontSize(5).font('Helvetica').fillColor('#ffffff', 0.5);
    doc.text('EXPIRES', W / 2 + 10, detY + 20);
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#ef4444');
    doc.text(new Date(card.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), W / 2 + 10, detY + 27);

    doc.fontSize(5).font('Helvetica').fillColor('#ffffff', 0.5);
    doc.text('SIA TYPE', W / 2 + 10, detY + 40);
    doc.fontSize(6).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text(card.officer?.sia_licence_type || '—', W / 2 + 10, detY + 47);

    // Bottom bar
    doc.rect(0, H - 12, W, 12).fill('#1a52a8');
    doc.fontSize(5).font('Helvetica').fillColor('#ffffff', 0.7)
      .text('Property of ' + (company?.name || 'Risk Secured Ltd') + ' — If found, return to issuer', 10, H - 9, { width: W - 20, align: 'center' });

    doc.end();
  } catch (err) { next(err); }
});

module.exports = router;
