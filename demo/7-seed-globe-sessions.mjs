/**
 * DEMO 7: Globe Population — Seed Fake Global Sessions
 * ─────────────────────────────────────────────────────
 * Seeds MongoDB with realistic fake sessions from cities around the world
 * to demonstrate the 3D Globe visualization in the Admin Dashboard.
 *
 * This simulates multiple users logged in simultaneously from different
 * geographic locations — exactly what the globe is designed to show.
 *
 * Run this, then open http://localhost:3000/admin to see the globe light up!
 */

import { MongoClient, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI ||
  "mongodb+srv://achintyak30_db_user:yH5jGWtgurp0waC8@sentinentalstack.jnxkadl.mongodb.net/?appName=sentinentalStack";

// Fake user sessions from around the world
const FAKE_SESSIONS = [
  {
    email: "demo-mumbai@sentinelstack.local",
    ipAddress: "117.215.0.1",
    location: { lat: 19.076, lon: 72.8777, city: "Mumbai", country: "India" },
    isFlagged: false, riskScore: 0
  },
  {
    email: "demo-newyork@sentinelstack.local",
    ipAddress: "74.125.0.1",
    location: { lat: 40.7128, lon: -74.006, city: "New York", country: "USA" },
    isFlagged: false, riskScore: 15
  },
  {
    email: "demo-london@sentinelstack.local",
    ipAddress: "81.2.69.1",
    location: { lat: 51.5074, lon: -0.1278, city: "London", country: "United Kingdom" },
    isFlagged: false, riskScore: 5
  },
  {
    email: "demo-tokyo@sentinelstack.local",
    ipAddress: "203.0.113.1",
    location: { lat: 35.6762, lon: 139.6503, city: "Tokyo", country: "Japan" },
    isFlagged: true, riskScore: 72   // ← Flagged! Shows red on globe
  },
  {
    email: "demo-saopaulo@sentinelstack.local",
    ipAddress: "200.89.0.1",
    location: { lat: -23.5505, lon: -46.6333, city: "São Paulo", country: "Brazil" },
    isFlagged: false, riskScore: 20
  },
  {
    email: "demo-sydney@sentinelstack.local",
    ipAddress: "101.0.86.1",
    location: { lat: -33.8688, lon: 151.2093, city: "Sydney", country: "Australia" },
    isFlagged: false, riskScore: 8
  },
  {
    email: "demo-dubai@sentinelstack.local",
    ipAddress: "5.62.0.1",
    location: { lat: 25.2048, lon: 55.2708, city: "Dubai", country: "UAE" },
    isFlagged: true, riskScore: 88  // ← High-risk, flagged! Big red marker
  },
  {
    email: "demo-berlin@sentinelstack.local",
    ipAddress: "84.19.0.1",
    location: { lat: 52.52, lon: 13.405, city: "Berlin", country: "Germany" },
    isFlagged: false, riskScore: 30
  },
  {
    email: "demo-capetown@sentinelstack.local",
    ipAddress: "41.203.0.1",
    location: { lat: -33.9249, lon: 18.4241, city: "Cape Town", country: "South Africa" },
    isFlagged: false, riskScore: 10
  },
  {
    email: "demo-moscow@sentinelstack.local",
    ipAddress: "178.248.0.1",
    location: { lat: 55.7558, lon: 37.6173, city: "Moscow", country: "Russia" },
    isFlagged: true, riskScore: 95   // ← Critical! Largest red marker
  }
];

async function seedGlobeSessions() {
  console.log("\n🌍 DEMO 7: Globe Population — Seeding Fake Global Sessions");
  console.log("━".repeat(60));
  console.log(`Seeding ${FAKE_SESSIONS.length} sessions from cities around the world...\n`);

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    // Clean up previous demo sessions
    const deleteResult = await db.collection("session").deleteMany({
      ipAddress: { $in: FAKE_SESSIONS.map(s => s.ipAddress) }
    });
    if (deleteResult.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deleteResult.deletedCount} previous demo sessions\n`);
    }

    // Also seed fake users for these sessions
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    let seeded = 0;
    for (const session of FAKE_SESSIONS) {
      // Upsert a fake user
      const userId = new ObjectId();
      await db.collection("user").updateOne(
        { email: session.email },
        {
          $setOnInsert: {
            _id: userId,
            id: userId.toString(),
            name: session.location.city + " User",
            email: session.email,
            emailVerified: true,
            isFlagged: session.isFlagged,
            riskScore: session.riskScore,
            createdAt: now,
            updatedAt: now
          }
        },
        { upsert: true }
      );

      const user = await db.collection("user").findOne({ email: session.email });
      const actualUserId = user?._id ?? userId;

      // Insert a fake active session
      const sessionId = new ObjectId();
      await db.collection("session").insertOne({
        _id: sessionId,
        id: sessionId.toString(),
        token: `demo-token-${sessionId.toString()}`,
        userId: actualUserId,
        expiresAt,
        ipAddress: session.ipAddress,
        userAgent: "Mozilla/5.0 (Demo Browser) SentinelStack/1.0",
        location: session.location,
        createdAt: new Date(now.getTime() - Math.random() * 3600000),
        updatedAt: now
      });

      const flag = session.isFlagged ? "🔴 FLAGGED" : "🟢 Normal";
      console.log(`   ✅ ${session.location.city}, ${session.location.country} — Risk: ${session.riskScore} ${flag}`);
      seeded++;
    }

    console.log(`\n✅ Seeded ${seeded} fake sessions into MongoDB!`);
    console.log("\n🌐 Now open: http://localhost:3000/admin");
    console.log("   → The 3D Globe will show sessions as points on the map");
    console.log("   → 🟢 Green dots = normal sessions");
    console.log("   → 🔴 Red dots  = flagged/high-risk sessions (larger markers)");
    console.log("\n⚠️  To clean up after demo:");
    console.log("   node demo/7-cleanup-demo-sessions.mjs\n");

  } finally {
    await client.close();
  }
}

seedGlobeSessions().catch(console.error);
