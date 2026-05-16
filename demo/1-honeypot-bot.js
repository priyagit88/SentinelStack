/**
 * DEMO 1: Honeypot Bot Attack
 * ───────────────────────────
 * Simulates a bot that auto-fills ALL form fields, including the hidden
 * honeypot field (name="website"). Real users never see or fill this field.
 *
 * SentinelStack Response:
 *   - Logs a HIGH severity "HONEYPOT" event
 *   - Returns 200 OK (silently drops the registration to confuse the bot)
 *   - No account is created
 */

const BASE_URL = "http://localhost:3000";

async function runHoneypotAttack() {
  console.log("\n🤖 DEMO 1: Honeypot Bot Attack");
  console.log("━".repeat(50));
  console.log("Simulating a bot that fills ALL form fields...\n");

  const payload = {
    name: "Totally Real Human",
    email: `bot-${Date.now()}@attack.com`,
    password: "password123",
    website: "http://spam-site.com", // ← This is the hidden honeypot field!
    focusToSubmitMs: 120             // ← Bot is also suspiciously fast
  };

  console.log("📤 Sending registration with honeypot field populated:");
  console.log(`   email: ${payload.email}`);
  console.log(`   website (honeypot): "${payload.website}" ← Bot filled this!`);
  console.log(`   focusToSubmitMs: ${payload.focusToSubmitMs}ms\n`);

  const res = await fetch(`${BASE_URL}/api/security/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  
  console.log(`📥 Response: HTTP ${res.status}`);
  console.log(`   ${JSON.stringify(data)}`);
  console.log("\n✅ SentinelStack Result:");
  console.log("   → Logged as HIGH severity HONEYPOT event in MongoDB");
  console.log("   → Registration silently dropped (bot gets no error feedback)");
  console.log("   → No account created in the database");
  console.log("   → Check Admin Dashboard → Security Feed to see the alert!\n");
}

runHoneypotAttack().catch(console.error);
