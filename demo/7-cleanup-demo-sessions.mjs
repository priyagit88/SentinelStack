/**
 * Cleanup — Remove Demo Globe Sessions
 * Run this after your demo presentation to clean up seeded data.
 */

import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI ||
  "mongodb+srv://achintyak30_db_user:yH5jGWtgurp0waC8@sentinentalstack.jnxkadl.mongodb.net/?appName=sentinentalStack";

const DEMO_IPS = [
  "117.215.0.1", "74.125.0.1", "81.2.69.1", "203.0.113.1",
  "200.89.0.1", "101.0.86.1", "5.62.0.1", "84.19.0.1",
  "41.203.0.1", "178.248.0.1"
];

async function cleanup() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    const sessions = await db.collection("session").deleteMany({ ipAddress: { $in: DEMO_IPS } });
    const users = await db.collection("user").deleteMany({ email: /sentinelstack\.local$/ });
    console.log(`\n🧹 Cleanup complete!`);
    console.log(`   Removed ${sessions.deletedCount} demo sessions`);
    console.log(`   Removed ${users.deletedCount} demo users\n`);
  } finally {
    await client.close();
  }
}

cleanup().catch(console.error);
