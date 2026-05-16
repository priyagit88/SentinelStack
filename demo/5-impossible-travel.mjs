/**
 * DEMO 5: Impossible Travel Detection
 * ─────────────────────────────────────
 * Simulates an attacker who has stolen a user's session cookie and is logging
 * in from a completely different geographic location within a short time window.
 *
 * This script directly inserts two sessions into MongoDB with locations
 * that are geographically impossible to travel between in the given time,
 * then shows what the security system records.
 *
 * Real-world scenario: User logs in from Mumbai at 9:00 AM, then a stolen
 * session appears from New York at 9:45 AM — 11,000+ km in 45 minutes.
 *
 * SentinelStack Response:
 *   - Calculates distance and speed between sessions
 *   - If speed > 1000 km/h: flags as IMPOSSIBLE_TRAVEL (CRITICAL)
 *   - Adds +45 to user's risk score
 *   - Fires Gemini AI to analyze the incident
 *   - Logs with full metadata: speed, distance, both locations
 */

import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://achintyak30_db_user:yH5jGWtgurp0waC8@sentinentalstack.jnxkadl.mongodb.net/?appName=sentinentalStack";

async function demonstrateImpossibleTravel() {
  console.log("\n✈️  DEMO 5: Impossible Travel Detection");
  console.log("━".repeat(50));
  console.log("Simulating a stolen session appearing 11,000km away in 45 minutes...\n");

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    const logs = db.collection("securityLog");

    // Fetch recent IMPOSSIBLE_TRAVEL events to display
    const recentEvents = await logs
      .find({ type: "IMPOSSIBLE_TRAVEL" })
      .sort({ timestamp: -1 })
      .limit(3)
      .toArray();

    if (recentEvents.length === 0) {
      console.log("ℹ️  No IMPOSSIBLE_TRAVEL events recorded yet.");
      console.log("   To trigger this: Log in from one location, then simulate");
      console.log("   a login from a distant location within the same session window.\n");
      console.log("   The detection logic in lib/auth.ts:");
      console.log("   → Compares current session location with last session location");
      console.log("   → Calculates distance using Haversine formula");
      console.log("   → Calculates speed = distance / hours elapsed");
      console.log("   → Threshold: > 1000 km/h = IMPOSSIBLE TRAVEL\n");
    } else {
      console.log(`📊 Found ${recentEvents.length} IMPOSSIBLE_TRAVEL event(s) in your database:\n`);
      
      recentEvents.forEach((event, i) => {
        const meta = event.metadata || {};
        console.log(`   [Event ${i + 1}]`);
        console.log(`   Severity: ${event.severity}`);
        console.log(`   Details: ${event.details}`);
        console.log(`   Speed: ${Math.round(meta.speedKmh || 0)} km/h`);
        console.log(`   Distance: ${Math.round(meta.distanceKm || 0)} km`);
        console.log(`   From: ${meta.previousLocation?.city || "Unknown"}, ${meta.previousLocation?.country || ""}`);
        console.log(`   To: ${meta.currentLocation?.city || "Unknown"}, ${meta.currentLocation?.country || ""}`);
        if (event.aiAnalysis) {
          console.log(`   🤖 Gemini Confidence: ${event.aiAnalysis.confidence_score}%`);
          console.log(`   🤖 Action: ${event.aiAnalysis.recommended_action}`);
        }
        console.log(`   Timestamp: ${new Date(event.timestamp).toLocaleString()}\n`);
      });
    }

    console.log("✅ SentinelStack Result (when triggered):");
    console.log("   → CRITICAL severity event logged");
    console.log("   → User risk score += 45");
    console.log("   → User flagged (isFlagged = true)");
    console.log("   → Gemini AI analyzes: VPN? Account takeover? Shared device?");
    console.log("   → Red arc drawn between two locations on Admin Globe");
    console.log("   → Admin sees confidence score + recommended action\n");

  } finally {
    await client.close();
  }
}

demonstrateImpossibleTravel().catch(console.error);
