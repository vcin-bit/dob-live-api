require('dotenv').config();
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db('dob_live');

  const { data: sites }     = await supabase.from('sites').select('id, name');
  const { data: companies } = await supabase.from('companies').select('id');
  const companyId = companies[0].id;

  // Build mongo _id -> supabase id map for sites
  const mongoSites = await db.collection('sites').find({}).toArray();
  const siteById = {};
  for (const ms of mongoSites) {
    const match = sites.find(s => s.name.toLowerCase().trim() === (ms.name||'').toLowerCase().trim());
    if (match) siteById[ms._id.toString()] = match.id;
  }
  console.log(`Site map: ${Object.keys(siteById).length} sites`);

  // ── Officer Rates ──
  const rates = await db.collection('officerrates').find({}).toArray();
  console.log(`\nOfficer rates: ${rates.length}`);
  const { data: sbUsers } = await supabase.from('users').select('id, email, first_name, last_name');
  const mongoOfficers = await db.collection('officers').find({}).toArray();
  const officerMap = {};
  for (const mo of mongoOfficers) {
    const match = sbUsers.find(u =>
      u.first_name?.toLowerCase() === (mo.firstName||'').toLowerCase() &&
      u.last_name?.toLowerCase()  === (mo.lastName||'').toLowerCase()
    );
    if (match) officerMap[mo._id.toString()] = match.id;
  }
  for (const r of rates) {
    const officerId = officerMap[r.officerId?.toString()];
    const siteId    = siteById[r.siteId?.toString()] || null;
    if (!officerId) { console.log(`  skip rate - no officer match`); continue; }
    const { error } = await supabase.from('officer_rates').insert({
      company_id: companyId, officer_id: officerId, site_id: siteId,
      hourly_rate: r.hourlyRate || r.rate || 0,
      role_label: r.roleLabel || '',
      effective_from: r.effectiveFrom || new Date().toISOString(),
    });
    if (error) console.log(`  error: ${error.message}`);
    else console.log(`  ✓ Rate for officer ${officerId}`);
  }

  // ── Patrol Routes ──
  const routes = await db.collection('patrolroutes').find({}).toArray();
  console.log(`\nPatrol routes: ${routes.length}`);
  for (const r of routes) {
    const siteId = siteById[r.siteId?.toString()];
    if (!siteId) { console.log(`  skip route "${r.name}" - no site`); continue; }
    const { data: route, error } = await supabase.from('patrol_routes').insert({
      company_id: companyId, site_id: siteId,
      name: r.name || 'Unnamed', instructions: r.instructions || '',
    }).select().single();
    if (error) { console.log(`  error: ${error.message}`); continue; }
    const checkpoints = r.checkpoints || r.waypoints || [];
    for (let i = 0; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      await supabase.from('patrol_checkpoints').insert({
        route_id: route.id, name: cp.name || `Checkpoint ${i+1}`,
        instructions: cp.instructions || '', order_index: i,
        lat: cp.lat || cp.latitude || null, lng: cp.lng || cp.longitude || null,
      });
    }
    console.log(`  ✓ ${r.name} (${checkpoints.length} checkpoints)`);
  }

  console.log('\n✅ Done');
  await mongo.close();
}

run().catch(console.error);
