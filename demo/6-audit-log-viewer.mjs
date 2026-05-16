/**
 * DEMO 6: Security Audit Log Viewer
 * ──────────────────────────────────
 * Reads all security events from MongoDB and displays a formatted
 * audit trail — showing who did what, when, and from where.
 *
 * This is what the Admin Dashboard reads to populate the Security Feed.
 */

import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://achintyak30_db_user:yH5jGWtgurp0waC8@sentinentalstack.jnxkadl.mongodb.net/?appName=sentinentalStack";

const SEVERITY_EMOJI = {
  LOW: "🟢",
  MEDIUM: "🟡",
  HIGH: "🟠",
  CRITICAL: "🔴"
};

const TYPE_EMOJI = {
  LOGIN_SUCCESS: "✅",
  LOGIN_FAILURE: "❌",
  REGISTER_SUCCESS: "👤",
  REGISTER_FAILURE: "🚫",
  HONEYPOT: "🍯",
  BOT_VELOCITY: "⚡",
  IMPOSSIBLE_TRAVEL: "✈️",
  SESSION_REVOKED: "🔒"
};

async function viewAuditLog() {
  console.log("\n📋 DEMO 6: Security Audit Log Viewer");
  console.log("━".repeat(60));
  console.log("Reading all security events from MongoDB...\n");

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();
    const logs = await db
      .collection("securityLog")
      .find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    if (logs.length === 0) {
      console.log("No security events recorded yet. Run the other demos first!\n");
      return;
    }

    // Group by type for summary
    const summary = {};
    logs.forEach(log => {
      summary[log.type] = (summary[log.type] || 0) + 1;
    });

    console.log("📊 SUMMARY (last 20 events):");
    Object.entries(summary).forEach(([type, count]) => {
      console.log(`   ${TYPE_EMOJI[type] || "📌"} ${type}: ${count}`);
    });
    console.log();

    console.log("📜 FULL AUDIT TRAIL (most recent first):\n");
    logs.forEach((log, i) => {
      const sev = SEVERITY_EMOJI[log.severity] || "⚪";
      const type = TYPE_EMOJI[log.type] || "📌";
      const time = new Date(log.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      
      console.log(`   [${String(i + 1).padStart(2, "0")}] ${sev} ${type} ${log.type}`);
      console.log(`        IP: ${log.ip}  |  Time: ${time}`);
      console.log(`        ${log.details}`);
      if (log.aiAnalysis?.confidence_score) {
        console.log(`        🤖 AI: ${log.aiAnalysis.confidence_score}% confidence — ${log.aiAnalysis.recommended_action}`);
      }
      console.log();
    });

  } finally {
    await client.close();
  }
}

viewAuditLog().catch(console.error);
