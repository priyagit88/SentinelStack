#!/usr/bin/env node
/**
 * SentinelStack — Master Demo Runner
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs all attack simulations sequentially with a clear presentation format.
 *
 * USAGE:
 *   Make sure the dev server is running first:
 *     npm run dev
 *
 *   Then in a second terminal:
 *     node demo/run-all-demos.js
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function banner() {
  console.clear();
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║        🛡️  SentinelStack — Attack Demo Suite             ║");
  console.log("║        Cybersecurity & Forensic Science — Domain 5       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\nPrerequisite: Ensure `npm run dev` is running on port 3000\n");
}

async function pause(ms = 2000) {
  return new Promise(r => setTimeout(r, ms));
}

function runScript(scriptPath) {
  try {
    execSync(`node "${scriptPath}"`, { stdio: "inherit" });
  } catch (e) {
    console.error(`\n⚠️  Script failed: ${e.message}`);
  }
}

async function main() {
  banner();

  const demos = [
    { file: "1-honeypot-bot.js",     title: "Honeypot Bot Detection" },
    { file: "2-velocity-bot.js",     title: "Velocity-Based Bot Detection" },
    { file: "3-brute-force-login.js",title: "Brute Force Login Attack" },
    { file: "4-oauth-bypass.js",     title: "OAuth Email Bypass Attempt" },
    { file: "5-impossible-travel.mjs", title: "Impossible Travel Detection" },
    { file: "6-audit-log-viewer.mjs",  title: "Security Audit Log" },
  ];

  for (let i = 0; i < demos.length; i++) {
    const demo = demos[i];
    const scriptPath = path.join(__dirname, demo.file);

    if (i > 0) {
      console.log("\n" + "─".repeat(60));
      console.log(`▶  Next: Demo ${i + 1} of ${demos.length} — ${demo.title}`);
      console.log("─".repeat(60));
      await pause(1500);
    }

    runScript(scriptPath);
    await pause(1000);
  }

  console.log("\n" + "═".repeat(60));
  console.log("🏁  All demos complete!");
  console.log("   → Open http://localhost:3000/admin to see all events");
  console.log("   → The Security Feed and Globe will show the logged attacks");
  console.log("═".repeat(60) + "\n");
}

main().catch(console.error);
