import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { connectMongoose } from "@/lib/db";
import { HoneyLog } from "@/lib/models/honey-log";

export const runtime = "nodejs";

/**
 * GET /api/security/admin/honeylogs
 * Returns the most recent HoneyLog entries for the admin Deception Intel tab.
 */
export async function GET() {
  const current = await auth.api.getSession({ headers: await headers() });
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim());
  if (adminEmails.length > 0 && !adminEmails.includes(current.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectMongoose();

  const logs = await HoneyLog.find({})
    .sort({ timestamp: -1 })
    .limit(100)
    .lean();

  // Group by session token for the admin to see full attacker journeys
  const serialized = logs.map(log => ({
    id:               log._id.toString(),
    sessionToken:     log.sessionToken,
    userEmail:        log.userEmail,
    ipAddress:        log.ipAddress,
    userAgent:        log.userAgent ?? null,
    location:         log.location ?? null,
    action:           log.action,
    payload:          log.payload ?? {},
    aiConfidenceScore: log.aiConfidenceScore ?? null,
    aiSummary:        log.aiSummary ?? null,
    timestamp:        log.timestamp
  }));

  // Compute unique attacker sessions
  const sessionMap = new Map<string, { email: string; ip: string; actions: number; firstSeen: Date; lastSeen: Date; confidence: number | null }>();
  for (const log of serialized) {
    const existing = sessionMap.get(log.sessionToken);
    if (existing) {
      existing.actions++;
      if (new Date(log.timestamp) < existing.firstSeen) existing.firstSeen = new Date(log.timestamp);
      if (new Date(log.timestamp) > existing.lastSeen) existing.lastSeen = new Date(log.timestamp);
    } else {
      sessionMap.set(log.sessionToken, {
        email: log.userEmail,
        ip: log.ipAddress,
        actions: 1,
        firstSeen: new Date(log.timestamp),
        lastSeen: new Date(log.timestamp),
        confidence: log.aiConfidenceScore
      });
    }
  }

  return NextResponse.json({
    logs: serialized,
    sessions: Array.from(sessionMap.entries()).map(([token, data]) => ({
      sessionToken: token,
      ...data
    }))
  });
}
