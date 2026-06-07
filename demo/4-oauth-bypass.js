/**
 * DEMO 4: OAuth Email Bypass / Account Takeover Attempt
 * ──────────────────────────────────────────────────────
 * Simulates an attacker trying to create a credential (email+password)
 * account using an email address that is already registered via Google/GitHub.
 *
 * Attack Goal: Gain password-based access to an OAuth-only account,
 * potentially bypassing MFA or session controls tied to the OAuth provider.
 *
 * SentinelStack Response:
 *   - Detects the email is linked to an OAuth provider in the database
 *   - Blocks the registration with a clear security message
 *   - Returns HTTP 400
 */

const BASE_URL = "http://localhost:3000";

// This email must be already registered via Google/GitHub OAuth in your app
const OAUTH_EMAIL = "achintyak30@gmail.com";

async function runOAuthBypass() {
  console.log("\n🎭 DEMO 4: OAuth Email Bypass / Account Takeover Attempt");
  console.log("━".repeat(50));
  console.log(`Attacker knows victim uses Google OAuth with: ${OAUTH_EMAIL}`);
  console.log("Attempting to create a password account with the same email...\n");

  const payload = {
    name: "Attacker",
    email: OAUTH_EMAIL,
    password: "H@ck3rP@ssw0rd!",
    website: "",
    focusToSubmitMs: 3200
  };

  console.log("📤 Sending credential registration for OAuth-linked email:");
  console.log(`   email: ${OAUTH_EMAIL}`);
  console.log(`   password: ${payload.password}\n`);

  const res = await fetch(`${BASE_URL}/api/security/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  
  console.log(`📥 Response: HTTP ${res.status}`);
  console.log(`   "${data.error ?? JSON.stringify(data)}"`);
  console.log("\n✅ SentinelStack Result:");

  if (res.status === 400 && data.error?.includes("Social Login")) {
    console.log("   → 🛡️  ATTACK BLOCKED!");
    console.log("   → Database check found this email is linked to Google/GitHub");
    console.log("   → Credential account creation denied");
    console.log("   → No password was set for the OAuth account");
  } else if (res.status === 422) {
    console.log("   → Email already registered — sign-in attempted instead");
  } else {
    console.log(`   → HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  console.log();
}

runOAuthBypass().catch(console.error);
