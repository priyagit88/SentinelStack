require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const accounts = await db.collection("account").find({}).toArray();
  console.log("Accounts[0]:", accounts[0]);
  const sessions = await db.collection("session").find({}).toArray();
  console.log("Sessions[0]:", sessions[0]);
  await client.close();
}

main().catch(console.error);
