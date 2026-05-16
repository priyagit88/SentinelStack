/**
 * DEMO 3: Brute Force Login Attack
 * ─────────────────────────────────
 * Simulates an attacker rapidly trying many passwords on a known email.
 * This is a classic credential stuffing / brute force attack.
 *
 * SentinelStack Response:
 *   - Each failed attempt logs a MEDIUM severity "LOGIN_FAILURE" event
 *   - All failures are visible in Admin Dashboard → Security Feed
 *   - IP address and target email are recorded for every attempt
 */

const BASE_URL = "http://localhost:3000";

const TARGET_EMAIL = "achintyak30@gmail.com"; // Target account
const PASSWORDS_TO_TRY = [
  "password123",
  "admin1234",
  "letmein!",
  "123456789",
  "qwerty123",
  "iloveyou1",
  "monkey123",
  "dragon123"
];

async function runBruteForce() {
  console.log("\n🔓 DEMO 3: Brute Force Login Attack");
  console.log("━".repeat(50));
  console.log(`Target account: ${TARGET_EMAIL}`);
  console.log(`Trying ${PASSWORDS_TO_TRY.length} common passwords...\n`);

  let attempt = 0;
  for (const password of PASSWORDS_TO_TRY) {
    attempt++;
    process.stdout.write(`   [${attempt}/${PASSWORDS_TO_TRY.length}] Trying "${password}"... `);

    const res = await fetch(`${BASE_URL}/api/security/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: TARGET_EMAIL, password })
    });

    if (res.ok) {
      console.log("✅ SUCCESS (password found!)");
      break;
    } else {
      const data = await res.json().catch(() => ({}));
      console.log(`❌ Failed — ${data.error ?? "Invalid credentials"}`);
    }

    // Small delay between attempts (a real bot might use 0ms)
    await new Promise(r => setTimeout(r, 300));
  }

  console.log("\n✅ SentinelStack Result:");
  console.log(`   → ${attempt} LOGIN_FAILURE events logged in MongoDB`);
  console.log("   → Each failure recorded: IP address + target email + timestamp");
  console.log("   → All visible in Admin Dashboard → Security Feed");
  console.log("   → Pattern analysis: same IP, same email = brute force signature\n");
}

runBruteForce().catch(console.error);
