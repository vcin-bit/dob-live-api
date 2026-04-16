const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`*, sender:users!messages_sender_id_fkey(id, first_name, last_name), recipient:users!messages_recipient_id_fkey(id, first_name, last_name)`)
      .eq('company_id', req.user.company_id)
      .or(`sender_id.eq.${req.user.id},recipient_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { recipient_id, body } = req.body;
    const { data, error } = await supabase
      .from('messages')
      .insert({ company_id: req.user.company_id, sender_id: req.user.id, recipient_id, body })
      .select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('recipient_id', req.user.id)
      .select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
