require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1); }

async function inspect() {
  const mongo = new MongoClient(MONGODB_URI);
  try {
    await mongo.connect();
    const db = mongo.db('dob_live');
    
    for (const col of ['shiftinstances', 'entries', 'handoverbriefs', 'messages']) {
      const doc = await db.collection(col).findOne({});
      console.log(`\n=== ${col} ===`);
      if (doc) console.log(JSON.stringify(doc, null, 2));
      else console.log('(empty)');
    }
  } finally {
    await mongo.close();
  }
}
inspect();
