# SentinelStack

SentinelStack is a secure authentication and visual threat intelligence platform built with Next.js 14 App Router, Tailwind CSS, MongoDB/Mongoose, Better Auth, `react-globe.gl`, and Gemini.

It demonstrates account registration, session management, bot detection, impossible-travel heuristics, concurrent session revocation, and an admin command center for live geospatial threat monitoring.

## What It Does

- Provides Better Auth email/password authentication backed by MongoDB.
- Extends user records with `isFlagged` and `riskScore`.
- Extends sessions with native location metadata: latitude, longitude, city, and country.
- Logs security events in a dedicated `SecurityLog` collection.
- Detects registration bots with a honeypot field and sub-1.5s submission timing.
- Enriches login sessions with IP geolocation.
- Detects impossible travel using the Haversine formula and an 800 km/h velocity threshold.
- Flags risky users, raises risk scores, and writes `CRITICAL` security logs.
- Sends high-risk events to Gemini for structured SOC-style JSON analysis when `GEMINI_API_KEY` is configured.
- Lets users view and revoke active sessions from `/profile`.
- Shows active sessions, flagged users, impossible-travel arcs, and a security feed in `/admin`.

## Requirements

- Node.js 18+
- npm
- MongoDB running locally or a MongoDB Atlas connection string

This project pins `better-auth` to `1.4.0` for compatibility with the Node version used in this workspace.

## Environment Setup

Create a `.env.local` file from the example:

```bash
cp .env.local
```

Then update the values:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/sentinelstack
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://localhost:3000
GEMINI_API_KEY=
```

`GEMINI_API_KEY` is optional. Without it, SentinelStack still logs high-risk incidents and stores a deterministic fallback analysis.

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Useful routes:

- `/register` - custom secure registration with honeypot and velocity detection
- `/login` - monitored login flow
- `/profile` - protected profile and active session management
- `/admin` - protected visual threat command center

## Verify

```bash
npm run typecheck
npm run lint
npm run build
```

## Security Flow

On registration, the client records the time between first field focus and submission. If the hidden `website` honeypot field is populated, the API silently returns success and logs a `HONEYPOT` event. If the form is submitted in under 1500ms, the request is logged as `BOT_VELOCITY`.

On login, Better Auth creates the session through a database hook. SentinelStack resolves the incoming IP location, compares it to the user’s previous session location, calculates spherical distance using Haversine geometry, and converts elapsed time into implied travel speed. Speeds above 800 km/h flag the user, increase their risk score, store the current location on the session, and create a `CRITICAL` `IMPOSSIBLE_TRAVEL` log.

For high-risk events, Gemini receives the suspicious login metadata plus the user’s five most recent historical sessions and returns structured JSON:

```json
{
  "incident_summary": "Context-aware SOC analysis.",
  "confidence_score": 88,
  "recommended_action": "Trigger Step-up Multi-Factor Authentication Challenge"
}
```

## Data Collections

- `user` - Better Auth users plus `isFlagged` and `riskScore`
- `session` - Better Auth sessions plus `location`
- `account` - Better Auth account records
- `verification` - Better Auth verification records
- `securityLog` - SentinelStack security events and AI analysis

## Notes

- Local/private IPs use realistic mock geolocation data so development works without a public IP.
- Real IP geolocation uses `ip-api.com` when the incoming IP is public.
- The profile UI attempts Better Auth’s `authClient.session.revoke({ id })` shape first and falls back to token-based `authClient.revokeSession({ token })` for compatibility.
