import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { connectMongoose } from "@/lib/db";
import { SecurityLog } from "@/lib/models/security-log";
import { Session } from "@/lib/models/session";
import { User } from "@/lib/models/user";

export const runtime = "nodejs";

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
  const [sessions, users, logs] = await Promise.all([
    Session.find({ expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .lean(),
    User.find({})
      .select("id email isFlagged riskScore")
      .lean(),
    SecurityLog.find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .lean()
  ]);

  const userById = new Map(users.flatMap((user) => [[String(user.id ?? user._id), user]]));

  return NextResponse.json({
    sessions: sessions
      .map((session) => {
        let location:
          | { lat?: number; lon?: number; city?: string; country?: string }
          | null
          | undefined = session.location;

        if (typeof session.location === "string") {
          try {
            location = JSON.parse(session.location) as typeof location;
          } catch (e) {
            location = null;
          }
        }
        return { ...session, location };
      })
      .filter((session) => session.location?.lat != null && session.location?.lon != null)
      .map((session) => {
        const user = userById.get(String(session.userId));
        return {
          id: session.id ?? session._id.toString(),
          userId: String(session.userId),
          email: user?.email ?? "unknown@sentinelstack.local",
          isFlagged: Boolean(user?.isFlagged),
          riskScore: Number(user?.riskScore ?? 0),
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          location: session.location,
          createdAt: session.createdAt
        };
      }),
    logs: logs.map((log) => ({
      id: log._id.toString(),
      type: log.type,
      severity: log.severity,
      details: log.details,
      ip: log.ip,
      timestamp: log.timestamp,
      aiAnalysis: log.aiAnalysis,
      metadata: log.metadata ?? {}
    }))
  });
}
