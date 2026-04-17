require('dotenv').config();
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db('dob_live');

  const { data: sites } = await supabase.from('sites').select('id, name');
  const { data: co }    = await supabase.from('companies').select('id').single();
  const companyId = co.id;

  // Build mongo siteId -> supabase id map
  const mongoSites = await db.collection('sites').find({}).toArray();
  const siteById = {};
  for (const ms of mongoSites) {
    const match = sites.find(s => s.name.toLowerCase().trim() === (ms.name||'').toLowerCase().trim());
    if (match) siteById[ms._id.toString()] = match.id;
  }
  console.log('Site map:', Object.keys(siteById).length, 'sites');

  // ── Site Instructions ──
  const instrDocs = await db.collection('siteinstructions').find({}).toArray();
  console.log(`\nSite instructions: ${instrDocs.length}`);
  let ok = 0;
  for (const doc of instrDocs) {
    if (!doc.sections?.length) continue;
    const siteId = siteById[doc.siteId?.toString()];
    if (!siteId) { console.log(`  skip: no site match for siteId ${doc.siteId}`); continue; }
    const sbSite = sites.find(s => s.id === siteId);
    const { error } = await supabase.from('site_instructions').upsert({
      company_id: companyId,
      site_id: siteId,
      sections: doc.sections,
    }, { onConflict: 'site_id' });
    if (error) console.log(`  error: ${error.message}`);
    else { console.log(`  ✓ ${sbSite?.name} (${doc.sections.length} sections)`); ok++; }
  }

  // ── Company Policies ──
  const policies = await db.collection('companypolicies').find({}).toArray();
  console.log(`\nCompany policies: ${policies.length}`);
  for (const p of policies) {
    if (!p.sections?.length) { console.log('  skip: no sections'); continue; }
    const { error } = await supabase.from('company_policies').upsert({
      company_id: companyId,
      sections: p.sections,
    }, { onConflict: 'company_id' });
    if (error) console.log(`  error: ${error.message}`);
    else console.log(`  ✓ Company policies (${p.sections.length} sections)`);
  }

  console.log('\n✅ Done');
  await mongo.close();
}

run().catch(console.error);
