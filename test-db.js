const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/sentinelstack";
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const accounts = await db.collection("account").find({}).toArray();
  console.log("Accounts:", accounts);
  const sessions = await db.collection("session").find({}).toArray();
  console.log("Sessions:", sessions);
  await client.close();
}

main().catch(console.error);
