require('dotenv').config();
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

const MONGODB_URI  = process.env.MONGODB_URI;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!MONGODB_URI || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars'); process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const mongo = new MongoClient(MONGODB_URI);
  try {
    await mongo.connect();
    const db = mongo.db('dob_live');

    // Get site name -> supabase id map
    const { data: sites } = await supabase.from('sites').select('id, name');
    const siteMap = Object.fromEntries((sites||[]).map(s => [s.name.toLowerCase().trim(), s.id]));
    console.log('Sites in Supabase:', Object.keys(siteMap).length);

    // Get company id
    const { data: co } = await supabase.from('companies').select('id').single();
    const companyId = co?.id;

    // Migrate site instructions
    const cols = await db.listCollections().toArray();
    const instrCol = cols.find(c => c.name.toLowerCase().includes('siteinstruction'));
    if (!instrCol) { console.log('No siteinstructions collection found'); return; }

    const docs = await db.collection(instrCol.name).find({}).toArray();
    console.log(`Found ${docs.length} site instruction documents`);

    let ok = 0, skip = 0;
    for (const doc of docs) {
      if (!doc.sections || doc.sections.length === 0) { skip++; continue; }

      // Match by site name
      const siteName = (doc.siteName || '').toLowerCase().trim();
      let siteId = siteMap[siteName];

      if (!siteId) {
        // Try partial match
        const match = Object.keys(siteMap).find(k => k.includes(siteName) || siteName.includes(k));
        if (match) siteId = siteMap[match];
      }

      if (!siteId) {
        console.log(`  ⚠️  No site match for: "${doc.siteName}"`);
        skip++;
        continue;
      }

      const { error } = await supabase.from('site_instructions').upsert({
        company_id: companyId,
        site_id: siteId,
        sections: doc.sections,
        updated_at: doc.updatedAt || new Date().toISOString(),
      }, { onConflict: 'site_id' });

      if (error) { console.log(`  ⚠️  Error: ${error.message}`); skip++; }
      else { console.log(`  ✓ ${doc.siteName} (${doc.sections.length} sections)`); ok++; }
    }

    // Also migrate company policies
    const policyCol = cols.find(c => c.name.toLowerCase().includes('companypolic'));
    if (policyCol) {
      const policies = await db.collection(policyCol.name).find({}).toArray();
      console.log(`\nFound ${policies.length} company policy documents`);
      for (const p of policies) {
        if (!p.sections || p.sections.length === 0) continue;
        const { error } = await supabase.from('company_policies').upsert({
          company_id: companyId,
          sections: p.sections,
        }, { onConflict: 'company_id' });
        if (error) console.log(`  ⚠️  Policy error: ${error.message}`);
        else console.log(`  ✓ Company policies (${p.sections.length} sections)`);
      }
    }

    console.log(`\n✅  Done: ${ok} migrated, ${skip} skipped`);
  } finally {
    await mongo.close();
  }
}

run().catch(console.error);
