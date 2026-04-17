require('dotenv').config();
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db('dob_live');

  // Get mongo officers/users
  const cols = (await db.listCollections().toArray()).map(c => c.name);
  console.log('Collections:', cols.join(', '));

  // Try officers collection first, then users
  const officerCol = cols.find(c => c.toLowerCase() === 'officers') || 
                     cols.find(c => c.toLowerCase() === 'users');
  
  if (!officerCol) { console.log('No officer/user collection found'); return; }

  const mongoOfficers = await db.collection(officerCol).find({}).toArray();
  console.log(`Found ${mongoOfficers.length} records in ${officerCol}`);

  // Get supabase users
  const { data: sbUsers } = await supabase.from('users').select('id, email, first_name, last_name');
  
  let updated = 0;
  for (const mo of mongoOfficers) {
    const email = (mo.email || '').toLowerCase().trim();
    const firstName = mo.firstName || mo.first_name || '';
    const lastName = mo.lastName || mo.last_name || '';
    
    // Try match by email first, then name
    let sbUser = sbUsers.find(u => u.email === email);
    if (!sbUser && firstName) {
      sbUser = sbUsers.find(u => 
        u.first_name?.toLowerCase() === firstName.toLowerCase() &&
        u.last_name?.toLowerCase() === lastName.toLowerCase()
      );
    }
    
    if (!sbUser) { 
      console.log(`  No match: ${firstName} ${lastName} (${email})`); 
      continue; 
    }

    const siaNumber = mo.siaNumber || mo.sia_licence_number || mo.siaLicence || null;
    const siaExpiry = mo.siaExpiry || mo.sia_expiry || mo.siaExpiryDate || null;
    const phone     = mo.phone || mo.mobile || mo.phoneNumber || null;

    if (!siaNumber && !siaExpiry && !phone) {
      console.log(`  Skip ${firstName} ${lastName} - no SIA data`);
      continue;
    }

    const updates = {};
    if (siaNumber) updates.sia_licence_number = String(siaNumber);
    if (siaExpiry) updates.sia_expiry_date = new Date(siaExpiry).toISOString().split('T')[0];
    if (phone)     updates.phone = String(phone);

    const { error } = await supabase.from('users').update(updates).eq('id', sbUser.id);
    if (error) { console.log(`  Error: ${error.message}`); continue; }
    console.log(`  ✓ ${firstName} ${lastName}: SIA ${siaNumber || '—'} exp ${siaExpiry || '—'}`);
    updated++;
  }

  console.log(`\n✅ Updated ${updated} users with SIA data`);
  await mongo.close();
}

run().catch(console.error);
