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

  // Get existing sites in Supabase
  const { data: sbSites } = await supabase.from('sites').select('id, name');
  const existingNames = new Set(sbSites.map(s => s.name.toLowerCase().trim()));

  // Get all sites from MongoDB
  const mongoSites = await db.collection('sites').find({}).toArray();
  console.log(`MongoDB sites: ${mongoSites.length}, Supabase sites: ${sbSites.length}`);

  const siteIdMap = {}; // mongo _id -> supabase id (existing)
  for (const ms of mongoSites) {
    const match = sbSites.find(s => s.name.toLowerCase().trim() === ms.name.toLowerCase().trim());
    if (match) siteIdMap[ms._id.toString()] = match.id;
  }

  // Insert missing sites
  let added = 0;
  for (const ms of mongoSites) {
    if (existingNames.has(ms.name.toLowerCase().trim())) continue;
    
    const { data: newSite, error } = await supabase.from('sites').insert({
      company_id: companyId,
      name: ms.name,
      address: ms.address || '',
      active: ms.status !== 'inactive',
    }).select().single();

    if (error) { console.log(`  error ${ms.name}: ${error.message}`); continue; }
    siteIdMap[ms._id.toString()] = newSite.id;
    console.log(`  ✓ Added site: ${ms.name}`);
    added++;
  }
  console.log(`\nSites added: ${added}`);

  // Now migrate site instructions for newly added sites
  const instrDocs = await db.collection('siteinstructions').find({}).toArray();
  console.log(`\nSite instructions: ${instrDocs.length}`);
  for (const doc of instrDocs) {
    const siteId = siteIdMap[doc.siteId?.toString()];
    if (!siteId) { console.log(`  skip - no site match`); continue; }
    const { data: sbSite } = await supabase.from('sites').select('name').eq('id', siteId).single();
    const { error } = await supabase.from('site_instructions').upsert({
      company_id: companyId,
      site_id: siteId,
      sections: doc.sections || [],
    }, { onConflict: 'site_id' });
    if (error) console.log(`  error: ${error.message}`);
    else console.log(`  ✓ Instructions for ${sbSite?.name}`);
  }

  // Migrate missing shifts
  const mongoShifts = await db.collection('shiftinstances').find({}).toArray();
  const { data: sbShifts } = await supabase.from('shifts').select('id');
  console.log(`\nShifts: MongoDB ${mongoShifts.length}, Supabase ${sbShifts.length}`);

  // Get officer map
  const mongoOfficers = await db.collection('officers').find({}).toArray();
  const { data: sbUsers } = await supabase.from('users').select('id, first_name, last_name');
  const officerMap = {};
  for (const mo of mongoOfficers) {
    const match = sbUsers.find(u =>
      u.first_name?.toLowerCase() === mo.firstName?.toLowerCase() &&
      u.last_name?.toLowerCase() === mo.lastName?.toLowerCase()
    );
    if (match) officerMap[mo._id.toString()] = match.id;
  }

  // Only migrate shifts for newly added sites
  let shiftsAdded = 0;
  for (const s of mongoShifts) {
    const siteId = siteIdMap[s.siteId?.toString()];
    if (!siteId) continue;
    // Check if already in supabase (we have 89, skip those)
    const officerId = officerMap[s.assignedOfficerId?.toString()] || null;
    const startTime = s.date && s.startTime ? 
      new Date(`${s.date.toISOString().split('T')[0]}T${s.startTime}`).toISOString() : 
      s.createdAt?.toISOString();

    const { error } = await supabase.from('shifts').insert({
      company_id: companyId,
      site_id: siteId,
      officer_id: officerId,
      start_time: startTime,
      end_time: null,
      status: s.status === 'completed' ? 'COMPLETED' : 'SCHEDULED',
      pay_rate: s.payRate || null,
      charge_rate: s.chargeRate || null,
      notes: s.notes || '',
    });
    if (!error) shiftsAdded++;
  }
  console.log(`Shifts added: ${shiftsAdded}`);

  console.log('\n✅ Done');
  await mongo.close();
}

run().catch(console.error);
