const router = require('express').Router();
const supabase = require('../lib/supabase');
const multer = require('multer');
const { authenticate, requireRole } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('companies').select('*').eq('id', req.user.company_id).single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.patch('/me', authenticate, requireRole('SUPER_ADMIN', 'COMPANY'), async (req, res, next) => {
  try {
    const allowed = ['name', 'email', 'phone', 'address', 'logo_url'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase
      .from('companies').update(updates).eq('id', req.user.company_id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/companies/logo — upload company logo
router.post('/logo', authenticate, requireRole('SUPER_ADMIN','COMPANY'), upload.single('logo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = req.file.originalname.split('.').pop() || 'png';
    const path = `${req.user.company_id}/logo.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('company-logos')
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (uploadErr) throw uploadErr;
    const { data: urlData } = supabase.storage.from('company-logos').getPublicUrl(path);
    const logo_url = urlData.publicUrl;
    await supabase.from('companies').update({ logo_url }).eq('id', req.user.company_id);
    res.json({ logo_url });
  } catch (err) { next(err); }
});

module.exports = router;
