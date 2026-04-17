require('dotenv').config();
const { MongoClient } = require('mongodb');

async function run() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db('dob_live');

  const folders = await db.collection('sitefolders').find({}).toArray();
  const docs = await db.collection('sitedocuments').find({}).toArray();
  const sites = await db.collection('sites').find({}).toArray();
  const siteMap = Object.fromEntries(sites.map(s => [s._id.toString(), s.name]));
  const folderMap = Object.fromEntries(folders.map(f => [f._id.toString(), f.name]));

  console.log(`Folders: ${folders.length}`);
  for (const f of folders) {
    console.log(`  ${siteMap[f.siteId?.toString()] || 'unknown site'} / ${f.name}`);
  }

  console.log(`\nDocuments: ${docs.length}`);
  for (const d of docs) {
    console.log(`  Site: ${siteMap[d.siteId?.toString()] || 'unknown'} | Folder: ${folderMap[d.folderId?.toString()] || 'unknown'} | File: ${d.name} | URL: ${d.r2Url}`);
  }

  await mongo.close();
}
run().catch(console.error);
