require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

const MONGODB_URI  = process.env.MONGODB_URI;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const mongo = new MongoClient(MONGODB_URI);
  await mongo.connect();
  const db = mongo.db('dob_live');

  // Get maps
  const { data: sites } = await supabase.from('sites').select('id, name');
  const { data: users } = await supabase.from('users').select('id, email');
  const { data: companies } = await supabase.from('companies').select('id');
  const companyId = companies[0].id;

  const siteByName = Object.fromEntries(sites.map(s => [s.name.toLowerCase().trim(), s.id]));
  const siteById = {}; // will fill from mongo _id -> supabase id mapping

  const cols = (await db.listCollections().toArray()).map(c => c.name);
  console.log('Collections:', cols.join(', '));

  // ── Build mongo _id -> supabase id map for sites ──
  const mongoSites = await db.collection('sites').find({}).toArray();
  for (const ms of mongoSites) {
    const name = (ms.name||'').toLowerCase().trim();
    const sbId = siteByName[name];
    if (sbId) siteById[ms._id.toString()] = sbId;
  }
  console.log(`Site map: ${Object.keys(siteById).length} sites`);

  // ── Officer Rates ──
  if (cols.includes('officerrates') || cols.includes('officer_rates')) {
    const col = cols.find(c => c.toLowerCase().includes('officerrate'));
    if (col) {
      const rates = await db.collection(col).find({}).toArray();
      console.log(`\nOfficer rates: ${rates.length}`);
      const { data: sbUsers } = await supabase.from('users').select('id, email');
      for (const r of rates) {
        const siteId = r.siteId ? siteById[r.siteId.toString()] : null;
        await supabase.from('officer_rates').insert({
          company_id: companyId,
          officer_id: null, // can't map without email
          site_id: siteId,
          hourly_rate: r.hourlyRate || r.rate || 0,
          role_label: r.roleLabel || r.label || '',
          effective_from: r.effectiveFrom || new Date().toISOString(),
        });
      }
      console.log('Officer rates migrated');
    }
  }

  // ── Patrol Routes ──
  const patrolCol = cols.find(c => c.toLowerCase().includes('patrol'));
  if (patrolCol) {
    const routes = await db.collection(patrolCol).find({}).toArray();
    console.log(`\nPatrol routes: ${routes.length}`);
    for (const r of routes) {
      const siteId = siteById[r.siteId?.toString()];
      if (!siteId) { console.log(`  skip route ${r.name} - no site`); continue; }
      const { data: route } = await supabase.from('patrol_routes').insert({
        company_id: companyId,
        site_id: siteId,
        name: r.name || 'Unnamed Route',
        instructions: r.instructions || '',
      }).select().single();
      if (route && r.checkpoints?.length) {
        for (let i = 0; i < r.checkpoints.length; i++) {
          const cp = r.checkpoints[i];
          await supabase.from('patrol_checkpoints').insert({
            route_id: route.id,
            name: cp.name || `Checkpoint ${i+1}`,
            instructions: cp.instructions || '',
            order_index: i,
            lat: cp.lat || cp.latitude || null,
            lng: cp.lng || cp.longitude || null,
          });
        }
        console.log(`  ✓ ${r.name} (${r.checkpoints.length} checkpoints)`);
      } else if (route) {
        console.log(`  ✓ ${r.name} (no checkpoints)`);
      }
    }
  }

  // ── Documents / Folders ──
  const folderCol = cols.find(c => c.toLowerCase().includes('folder') || c.toLowerCase().includes('document'));
  if (folderCol) {
    const docs = await db.collection(folderCol).find({}).toArray();
    console.log(`\nDocuments: ${docs.length}`);
    // migrate what we can - just folder structure
    for (const d of docs) {
      const siteId = siteById[d.siteId?.toString()];
      if (!siteId) continue;
      if (d.type === 'folder' || d.name && !d.fileUrl) {
        await supabase.from('site_folders').upsert({
          company_id: companyId,
          site_id: siteId,
          name: d.name || 'Folder',
        });
      }
    }
  }

  console.log('\n✅ Migration complete');
  await mongo.close();
}

run().catch(console.error);
