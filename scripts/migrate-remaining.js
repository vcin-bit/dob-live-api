require('dotenv').config();
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db('dob_live');

  const { data: sites }     = await supabase.from('sites').select('id, name');
  const { data: users }     = await supabase.from('users').select('id, email, first_name, last_name');
  const { data: companies } = await supabase.from('companies').select('id');
  const companyId = companies[0].id;

  // Build site map: mongo _id -> supabase id
  const mongoSites = await db.collection('sites').find({}).toArray();
  const siteById = {};
  for (const ms of mongoSites) {
    const match = sites.find(s => s.name.toLowerCase().trim() === (ms.name||'').toLowerCase().trim());
    if (match) siteById[ms._id.toString()] = match.id;
  }
  console.log(`Site map: ${Object.keys(siteById).length} sites\n`);

  // ── Shift Patterns (15) ──────────────────────────────────────────────
  const patterns = await db.collection('shiftpatterns').find({}).toArray();
  console.log(`Shift patterns: ${patterns.length}`);
  let ok = 0;
  for (const p of patterns) {
    const siteId = siteById[p.siteId?.toString()];
    if (!siteId) { console.log(`  skip "${p.name}" - no site`); continue; }
    const { error } = await supabase.from('shift_patterns').insert({
      company_id:   companyId,
      site_id:      siteId,
      name:         p.name || 'Pattern',
      days:         p.days || [],
      start_time:   p.startTime || '07:00',
      end_time:     p.endTime || '19:00',
      pay_rate:     null,
      charge_rate:  p.chargeRate || null,
      active:       p.active !== false,
      notes:        p.notes || '',
    });
    if (error) console.log(`  error ${p.name}: ${error.message}`);
    else { console.log(`  ✓ ${p.name}`); ok++; }
  }
  console.log(`  Done: ${ok}/${patterns.length}\n`);

  // ── Contract Lines (2) ───────────────────────────────────────────────
  const lines = await db.collection('contractlines').find({}).toArray();
  console.log(`Contract lines: ${lines.length}`);
  ok = 0;
  for (const l of lines) {
    const siteId = siteById[l.siteId?.toString()];
    if (!siteId) { console.log(`  skip "${l.name}" - no site`); continue; }
    const { error } = await supabase.from('contract_lines').insert({
      company_id:  companyId,
      site_id:     siteId,
      name:        l.name,
      category:    l.category || 'other',
      description: l.description || '',
      cost:        l.cost || 0,
      charge:      l.charge || 0,
      recurring:   l.recurring !== false,
      start_date:  l.startDate ? new Date(l.startDate).toISOString().split('T')[0] : null,
      end_date:    l.endDate   ? new Date(l.endDate).toISOString().split('T')[0]   : null,
      active:      l.active !== false,
      notes:       l.notes || '',
    });
    if (error) console.log(`  error: ${error.message}`);
    else { console.log(`  ✓ ${l.name}`); ok++; }
  }
  console.log(`  Done: ${ok}/${lines.length}\n`);

  // ── Contract Queries (1) ─────────────────────────────────────────────
  const queries = await db.collection('contractqueries').find({}).toArray();
  console.log(`Contract queries: ${queries.length}`);
  ok = 0;
  for (const q of queries) {
    const siteId = siteById[q.siteId?.toString()];
    const { error } = await supabase.from('contract_queries').insert({
      company_id:  companyId,
      site_id:     siteId || null,
      category:    q.category || 'other',
      subject:     q.subject,
      description: q.description,
      priority:    q.priority || 'medium',
      status:      q.status || 'open',
      responses:   q.responses || [],
    });
    if (error) console.log(`  error: ${error.message}`);
    else { console.log(`  ✓ ${q.subject}`); ok++; }
  }
  console.log(`  Done: ${ok}/${queries.length}\n`);

  // ── Client Alerts (12) ───────────────────────────────────────────────
  const alerts = await db.collection('clientalerts').find({}).toArray();
  console.log(`Client alerts: ${alerts.length}`);
  ok = 0;
  for (const a of alerts) {
    const siteId = siteById[a.site?.toString()];
    const { error } = await supabase.from('client_alerts').insert({
      company_id:  companyId,
      site_id:     siteId || null,
      title:       a.summary || 'Alert',
      description: a.comments || '',
      severity:    a.priority || 'medium',
      status:      a.status === 'completed' ? 'resolved' : 'open',
      created_at:  a.createdAt || new Date().toISOString(),
    });
    if (error) console.log(`  error: ${error.message}`);
    else ok++;
  }
  console.log(`  Done: ${ok}/${alerts.length}\n`);

  // ── Patrol Checklists -> patrol_routes (1) ───────────────────────────
  const checklists = await db.collection('patrolchecklists').find({}).toArray();
  console.log(`Patrol checklists: ${checklists.length}`);
  ok = 0;
  for (const c of checklists) {
    const siteId = siteById[c.siteId?.toString()];
    if (!siteId) { console.log(`  skip - no site`); continue; }
    const { data: route, error } = await supabase.from('patrol_routes').insert({
      company_id: companyId,
      site_id:    siteId,
      name:       'Default Patrol Route',
      instructions: '',
    }).select().single();
    if (error) { console.log(`  error: ${error.message}`); continue; }
    const checkpoints = c.checkpoints || [];
    for (let i = 0; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      await supabase.from('patrol_checkpoints').insert({
        route_id:    route.id,
        name:        cp.name || cp.label || `Checkpoint ${i+1}`,
        instructions: cp.instructions || cp.description || '',
        order_index: i,
        lat:         cp.lat || null,
        lng:         cp.lng || null,
      });
    }
    console.log(`  ✓ Patrol route (${checkpoints.length} checkpoints)`);
    ok++;
  }

  console.log('\n✅ All done');
  await mongo.close();
}

run().catch(console.error);
