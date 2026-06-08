/**
 * DEMO 8: Bot Login & Deception Mode Telemetry Simulation
 * ───────────────────────────────────────────────────────
 * Simulates a bot logging in with target credentials in 200ms.
 * 
 * SentinelStack Response:
 *   - Detects the speed anomaly (bot velocity < 1500ms)
 *   - Diverts the session to Deception Mode / Honeypot
 *   - Simulates malicious honeypot interactions to populate the Admin dashboard.
 */

const BASE_URL = "http://localhost:3000";
const EMAIL = "achintyak.mca25@rvce.edu.in";
const PASSWORD = "12345678";

async function runDeceptionDemo() {
  console.log("\n🤖 DEMO 8: Bot Login & Deception Mode Simulation");
  console.log("━".repeat(60));
  console.log(`Target credentials:`);
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
  console.log(`   Velocity: 200ms (threshold: 1500ms)\n`);

  console.log("📤 Sending login request with speed-bot timing...");
  
  const res = await fetch(`${BASE_URL}/api/security/login`, {
    method: "POST",
    headers: { 
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (Mock Bot/1.0; AttackSimulation)"
    },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      focusToSubmitMs: 200, // Speed bot timing
      captchaToken: "MOCK_TOKEN_PASS" // Will pass captcha mock verification
    })
  });

  const body = await res.json().catch(() => ({}));
  console.log(`📥 Response: HTTP ${res.status}`);
  console.log(`   Payload: ${JSON.stringify(body)}`);

  if (!body.deceptionMode) {
    console.error("\n❌ Error: Deception mode was not triggered.");
    console.error("   Ensure the credentials match, the account exists/is verified, and the captcha verification succeeds.");
    return;
  }

  console.log("\n🔥 Deception Mode Activated successfully!");
  console.log("   Session intercepted and routed to shadow environment.");

  // Extract deception cookies to simulate frontend interactions
  const setCookies = res.headers.getSetCookie();
  const cookies = [];
  for (const cookieHeader of setCookies) {
    const parts = cookieHeader.split(";")[0];
    if (parts) cookies.push(parts);
  }
  const cookieString = cookies.join("; ");

  if (cookieString) {
    console.log(`   Extracted cookies: ${cookieString}`);
  }

  console.log("\n🎯 Simulating attacker interactions inside the Honeypot...");
  console.log("━".repeat(60));

  const actions = [
    {
      action: "VIEW_PROFILE",
      payload: {},
      description: "Attacker loads mock profile page to inspect target details"
    },
    {
      action: "POST_CONTENT",
      payload: { content: "System hacked! Contact us at ransomware@attacker.com to decrypt." },
      description: "Attacker attempts to post defacement/ransomware message to the public student forum"
    },
    {
      action: "CHANGE_PASSWORD_ATTEMPT",
      payload: { currentPassword: PASSWORD, newPassword: "MaliciousPassword999!" },
      description: "Attacker attempts to hijack the account by changing the password"
    }
  ];

  for (const item of actions) {
    console.log(`\n👉 Action: ${item.action}`);
    console.log(`   Description: ${item.description}`);
    if (Object.keys(item.payload).length > 0) {
      console.log(`   Payload: ${JSON.stringify(item.payload)}`);
    }

    const actionRes = await fetch(`${BASE_URL}/api/honey/action`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": cookieString
      },
      body: JSON.stringify({
        action: item.action,
        payload: item.payload
      })
    });

    console.log(`   Result: HTTP ${actionRes.status} (${actionRes.ok ? "Logged" : "Failed"})`);
    await new Promise(resolve => setTimeout(resolve, 800)); // Delay between actions
  }

  console.log("\n" + "═".repeat(60));
  console.log("🏁  Demo Complete!");
  console.log("   → Attacker has been successfully trapped.");
  console.log("   → Go to: http://localhost:3000/admin");
  console.log("   → Select: 'Deception Mode Intel' tab");
  console.log("   → You will see the active session under 'Trapped Attackers' and their live actions in the feed!");
  console.log("═".repeat(60) + "\n");
}

runDeceptionDemo().catch(console.error);
