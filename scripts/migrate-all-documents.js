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

  const mongoSites  = await db.collection('sites').find({}).toArray();
  const { data: sbSites } = await supabase.from('sites').select('id, name');

  // Build site map mongo _id -> supabase id
  const siteMap = {};
  for (const ms of mongoSites) {
    const sb = sbSites.find(s => s.name.toLowerCase().trim() === ms.name.toLowerCase().trim());
    if (sb) siteMap[ms._id.toString()] = sb.id;
  }

  // ── Folders ──────────────────────────────────────────────────────────
  const mongoFolders = await db.collection('sitefolders').find({}).toArray();
  console.log(`\nFolders in MongoDB: ${mongoFolders.length}`);

  // Clear existing folders and re-migrate fresh
  await supabase.from('site_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('site_folders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Cleared existing folders and documents');

  const folderMap = {}; // mongo _id -> supabase id
  for (const f of mongoFolders) {
    const siteId = siteMap[f.siteId?.toString()];
    if (!siteId) { console.log(`  skip folder "${f.name}" - no site match`); continue; }
    const { data, error } = await supabase.from('site_folders').insert({
      company_id: companyId,
      site_id: siteId,
      name: f.name,
      description: f.description || '',
    }).select().single();
    if (error) { console.log(`  error: ${error.message}`); continue; }
    folderMap[f._id.toString()] = data.id;
    const site = sbSites.find(s => s.id === siteId);
    console.log(`  ✓ Folder: ${site?.name} / ${f.name}`);
  }

  // ── Documents ─────────────────────────────────────────────────────────
  const mongoDocs = await db.collection('sitedocuments').find({}).toArray();
  console.log(`\nDocuments in MongoDB: ${mongoDocs.length}`);

  for (const d of mongoDocs) {
    const siteId = siteMap[d.siteId?.toString()];
    const folderId = folderMap[d.folderId?.toString()] || null;
    if (!siteId) { console.log(`  skip "${d.name}" - no site`); continue; }

    const { error } = await supabase.from('site_documents').insert({
      company_id: companyId,
      site_id: siteId,
      folder_id: folderId,
      name: d.name || d.originalName,
      original_name: d.originalName || d.name,
      mime_type: d.mimeType || '',
      file_size: d.size || 0,
      // R2 full URL stored as storage_path - view button handles both
      storage_path: d.r2Url || d.r2Key || '',
      created_at: d.createdAt || new Date().toISOString(),
    });
    if (error) console.log(`  error "${d.name}": ${error.message}`);
    else console.log(`  ✓ Doc: ${d.name} -> ${d.r2Url}`);
  }

  // Final summary
  const { data: finalFolders } = await supabase.from('site_folders').select('name, site_id');
  const { data: finalDocs } = await supabase.from('site_documents').select('name, folder_id');
  console.log(`\n✅ Done: ${finalFolders?.length} folders, ${finalDocs?.length} documents in Supabase`);

  await mongo.close();
}

run().catch(console.error);
