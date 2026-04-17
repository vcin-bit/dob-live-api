require('dotenv').config();
const { MongoClient } = require('mongodb');

async function run() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db('dob_live');

  const toCheck = ['shiftpatterns', 'contractlines', 'contractqueries', 'clientalerts', 'companypolicies', 'patrolchecklists'];
  for (const col of toCheck) {
    const count = await db.collection(col).countDocuments();
    if (count > 0) {
      const sample = await db.collection(col).findOne({});
      console.log(`${col}: ${count} docs | keys: ${Object.keys(sample).join(', ')}`);
    } else {
      console.log(`${col}: 0 docs`);
    }
  }
  await mongo.close();
}
run().catch(console.error);
