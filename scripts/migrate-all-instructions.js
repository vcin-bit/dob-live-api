require('dotenv').config();
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db('dob_live');

  const { data: companies } = await supabase.from('companies').select('id');
  const companyId = companies[0].id;

  // Get ALL sites from both systems
  const mongoSites = await db.collection('sites').find({}).toArray();
  const { data: sbSites } = await supabase.from('sites').select('id, name');
  
  console.log(`MongoDB sites: ${mongoSites.length}`);
  console.log(`Supabase sites: ${sbSites.length}`);
  console.log('');

  // Build complete map - mongo _id -> supabase id
  const siteMap = {};
  for (const ms of mongoSites) {
    const sb = sbSites.find(s => 
      s.name.toLowerCase().trim() === ms.name.toLowerCase().trim()
    );
    if (sb) {
      siteMap[ms._id.toString()] = sb.id;
      console.log(`  mapped: ${ms.name} -> ${sb.id}`);
    } else {
      console.log(`  NO MATCH: ${ms.name}`);
    }
  }

  // Get ALL site instructions from MongoDB
  const allInstructions = await db.collection('siteinstructions').find({}).toArray();
  console.log(`\nTotal site instruction docs in MongoDB: ${allInstructions.length}`);

  for (const doc of allInstructions) {
    const mongoSiteId = doc.siteId?.toString();
    const sbSiteId = siteMap[mongoSiteId];
    const mongoSite = mongoSites.find(s => s._id.toString() === mongoSiteId);
    
    console.log(`\nProcessing: ${mongoSite?.name || 'unknown'} (${doc.sections?.length || 0} sections)`);
    
    if (!sbSiteId) {
      console.log(`  !! No Supabase match - creating site first`);
      if (!mongoSite) { console.log('  !! Cannot find mongo site'); continue; }
      
      const { data: newSite, error: siteError } = await supabase.from('sites').insert({
        company_id: companyId,
        name: mongoSite.name,
        address: mongoSite.address || '',
        active: mongoSite.status !== 'inactive',
      }).select().single();
      
      if (siteError) { console.log(`  !! Site create error: ${siteError.message}`); continue; }
      siteMap[mongoSiteId] = newSite.id;
      console.log(`  Created site: ${newSite.name}`);
    }

    if (!doc.sections?.length) {
      console.log('  No sections - skipping');
      continue;
    }

    const { error } = await supabase.from('site_instructions').upsert({
      company_id: companyId,
      site_id: siteMap[mongoSiteId],
      sections: doc.sections,
    }, { onConflict: 'site_id' });

    if (error) console.log(`  !! Error: ${error.message}`);
    else console.log(`  ✓ Saved ${doc.sections.length} sections`);
  }

  // Final count
  const { data: final } = await supabase.from('site_instructions').select('site_id, sections');
  console.log(`\nSite instructions in Supabase: ${final?.length}`);
  for (const f of final || []) {
    const site = sbSites.find(s => s.id === f.site_id);
    console.log(`  ${site?.name}: ${f.sections?.length} sections`);
  }

  console.log('\n✅ Done');
  await mongo.close();
}

run().catch(console.error);
