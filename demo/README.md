# SentinelStack — Attack Demo Scripts

These scripts demonstrate each security feature live against your running app.

## Setup

Make sure the dev server is running first:
```bash
npm run dev
```

Then open a **second terminal** and run demos from the project root.

---

## Running All Demos
```bash
node demo/run-all-demos.mjs
```

---

## Individual Demos

### Demo 1 — Honeypot Bot Detection
```bash
node demo/1-honeypot-bot.js
```
Simulates a bot that fills all fields including the hidden honeypot field.  
**Triggers:** `HONEYPOT` event (HIGH severity) in the Security Feed.

---

### Demo 2 — Velocity Bot Detection
```bash
node demo/2-velocity-bot.js
```
Simulates a bot that submits the form in 200ms (threshold: 1500ms).  
**Triggers:** `BOT_VELOCITY` event (MEDIUM severity) + user flagged with +25 risk score.

---

### Demo 3 — Brute Force Login Attack
```bash
node demo/3-brute-force-login.js
```
Tries 8 common passwords against a target email address.  
**Triggers:** 8× `LOGIN_FAILURE` events (MEDIUM severity) in the Security Feed.

---

### Demo 4 — OAuth Email Bypass
```bash
node demo/4-oauth-bypass.js
```
Tries to create a credential account for an email already linked to Google OAuth.  
**Triggers:** HTTP 400 with a security error message blocking the attempt.

---

### Demo 5 — Impossible Travel Detection
```bash
node demo/5-impossible-travel.mjs
```
Reads existing `IMPOSSIBLE_TRAVEL` events from MongoDB and displays them.  
This is automatically triggered when a real login happens from two geographically  
impossible locations in a short time window.  
**Shows:** Speed, distance, Gemini AI confidence score, recommended action.

---

### Demo 6 — Security Audit Log
```bash
node demo/6-audit-log-viewer.mjs
```
Reads the last 20 security events directly from MongoDB and displays a  
human-readable audit trail with severity, type, IP, time, and AI analysis.

---

## What to Show in the Admin Dashboard
After running all demos, open **http://localhost:3000/admin**:
- 🌍 **Globe** — Active sessions shown as geographic dots
- 📋 **Security Feed** — All logged attack events with severity badges
- 🤖 **AI Analysis** — Gemini confidence score on IMPOSSIBLE_TRAVEL events
