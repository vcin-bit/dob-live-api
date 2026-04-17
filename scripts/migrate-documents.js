require('dotenv').config();
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

const mongo_uri  = process.env.MONGODB_URI;
const sb_url     = process.env.SUPABASE_URL;
const sb_key     = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(sb_url, sb_key);

async function run() {
  const mongo = new MongoClient(mongo_uri);
  await mongo.connect();
  const db = mongo.db('dob_live');

  const cols = (await db.listCollections().toArray()).map(c => c.name);
  console.log('Collections:', cols.join(', '));

  // Maps
  const { data: sites }     = await supabase.from('sites').select('id, name');
  const { data: companies } = await supabase.from('companies').select('id');
  const companyId           = companies[0].id;

  // Build site _id -> supabase id map
  const mongoSites = await db.collection('sites').find({}).toArray();
  const siteMap = {};
  for (const ms of mongoSites) {
    const match = sites.find(s => s.name.toLowerCase().trim() === ms.name?.toLowerCase().trim());
    if (match) siteMap[ms._id.toString()] = match.id;
  }
  console.log(`Site map: ${Object.keys(siteMap).length} sites\n`);

  // ── Folders ──────────────────────────────────────────────────────────
  const folderCol = cols.find(c => c.toLowerCase().includes('sitefolder'));
  const folderMap = {}; // mongo _id -> supabase id

  if (folderCol) {
    const folders = await db.collection(folderCol).find({}).toArray();
    console.log(`Folders: ${folders.length}`);
    let ok = 0;
    for (const f of folders) {
      const siteId = siteMap[f.siteId?.toString()];
      if (!siteId) { console.log(`  skip folder "${f.name}" - no site match`); continue; }
      const { data, error } = await supabase.from('site_folders').insert({
        company_id:  companyId,
        site_id:     siteId,
        name:        f.name || 'Folder',
        description: f.description || '',
      }).select().single();
      if (error) { console.log(`  error: ${error.message}`); continue; }
      folderMap[f._id.toString()] = data.id;
      console.log(`  ✓ ${f.name}`);
      ok++;
    }
    console.log(`Folders done: ${ok}\n`);
  }

  // ── Documents ─────────────────────────────────────────────────────────
  const docCol = cols.find(c => c.toLowerCase().includes('sitedocument'));
  if (docCol) {
    const docs = await db.collection(docCol).find({}).toArray();
    console.log(`Documents: ${docs.length}`);
    let ok = 0;
    for (const d of docs) {
      const siteId   = siteMap[d.siteId?.toString()];
      const folderId = folderMap[d.folderId?.toString()] || null;
      if (!siteId) { console.log(`  skip "${d.name}" - no site match`); continue; }
      const { error } = await supabase.from('site_documents').insert({
        company_id:    companyId,
        site_id:       siteId,
        folder_id:     folderId,
        name:          d.name || d.originalName || 'Document',
        original_name: d.originalName || d.name,
        mime_type:     d.mimeType || '',
        file_size:     d.size || 0,
        // Store R2 URL as storage_path so the View link works
        storage_path:  d.r2Url || d.r2Key || '',
        uploaded_by:   d.uploadedBy || null,
        created_at:    d.createdAt || new Date().toISOString(),
      });
      if (error) { console.log(`  error: ${error.message}`); continue; }
      console.log(`  ✓ ${d.name}`);
      ok++;
    }
    console.log(`Documents done: ${ok}\n`);
  }

  console.log('✅ Done');
  await mongo.close();
}

run().catch(console.error);
