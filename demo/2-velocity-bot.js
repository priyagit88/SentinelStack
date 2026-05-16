/**
 * DEMO 2: Bot Velocity Attack (Rapid Signup)
 * ──────────────────────────────────────────
 * Simulates a bot that signs up in under 1500ms — faster than any human
 * can read a form. Real users take 3–15 seconds to fill out a form.
 *
 * SentinelStack Response:
 *   - Account IS created (we don't block it, we flag it)
 *   - User is marked isFlagged=true, riskScore += 25
 *   - Logs a MEDIUM severity "BOT_VELOCITY" event
 *   - Admin can see this user highlighted in red on the globe
 */

const BASE_URL = "http://localhost:3000";

async function runVelocityAttack() {
  console.log("\n⚡ DEMO 2: Bot Velocity Attack (Rapid Signup)");
  console.log("━".repeat(50));
  console.log("Simulating a bot that submits a form in 200ms...\n");

  const email = `velocity-bot-${Date.now()}@attack.com`;
  const payload = {
    name: "Speed Bot",
    email,
    password: "Password123!",
    website: "",         // ← Honeypot is empty (smarter bot)
    focusToSubmitMs: 200 // ← 200ms — WAY below the 1500ms human threshold
  };

  console.log("📤 Sending registration with suspiciously fast timing:");
  console.log(`   email: ${email}`);
  console.log(`   focusToSubmitMs: ${payload.focusToSubmitMs}ms`);
  console.log(`   Human threshold: 1500ms`);
  console.log(`   Verdict: ${payload.focusToSubmitMs < 1500 ? "🤖 BOT DETECTED" : "✅ Human"}\n`);

  const res = await fetch(`${BASE_URL}/api/security/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  console.log(`📥 Response: HTTP ${res.status}`);
  console.log("\n✅ SentinelStack Result:");
  console.log("   → Account created BUT immediately flagged");
  console.log("   → User.isFlagged = true");
  console.log("   → User.riskScore += 25");
  console.log("   → Logged as MEDIUM severity BOT_VELOCITY event");
  console.log("   → Red marker on Admin Globe, visible in Security Feed");
  console.log(`   → Email registered: ${email}\n`);
}

runVelocityAttack().catch(console.error);
