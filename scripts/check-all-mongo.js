require('dotenv').config();
const { MongoClient } = require('mongodb');

async function run() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db('dob_live');

  const cols = (await db.listCollections().toArray()).map(c => c.name);
  
  for (const col of cols) {
    const count = await db.collection(col).countDocuments();
    if (count > 0) {
      const sample = await db.collection(col).findOne({});
      const keys = Object.keys(sample);
      console.log(`${col}: ${count} docs | ${keys.join(', ')}`);
    } else {
      console.log(`${col}: empty`);
    }
  }

  await mongo.close();
}
run().catch(console.error);
