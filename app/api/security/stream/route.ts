import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { connectMongoose } from "@/lib/db";
import { SecurityLog } from "@/lib/models/security-log";
import { Session } from "@/lib/models/session";
import { User } from "@/lib/models/user";
import mongoose from "mongoose";

export const runtime = "nodejs";
// Disable Next.js response caching so the stream stays open
export const dynamic = "force-dynamic";

/** Serialise a SecurityLog document into the wire shape the client expects. */
function serializeLog(log: {
  _id: mongoose.Types.ObjectId;
  type: string;
  severity: string;
  details: string;
  ip: string;
  timestamp: Date;
  aiAnalysis?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}) {
  return {
    id: log._id.toString(),
    type: log.type,
    severity: log.severity,
    details: log.details,
    ip: log.ip,
    timestamp: log.timestamp,
    aiAnalysis: log.aiAnalysis ?? null,
    metadata: log.metadata ?? {}
  };
}

/** Build the full sessions+users snapshot (same logic as /api/security/admin). */
async function buildSnapshot() {
  const [sessions, users] = await Promise.all([
    Session.find({ expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .lean(),
    User.find({}).select("id email isFlagged riskScore").lean()
  ]);

  const userById = new Map(users.flatMap(u => [[String(u.id ?? u._id), u]]));

  return sessions
    .map(s => {
      if (typeof s.location === "string") {
        try { s.location = JSON.parse(s.location as unknown as string); }
        catch { s.location = undefined; }
      }
      return s;
    })
    .filter(s => s.location?.lat && s.location?.lon)
    .map(s => {
      const user = userById.get(String(s.userId));
      return {
        id: s.id ?? s._id.toString(),
        userId: String(s.userId),
        email: user?.email ?? "unknown@sentinelstack.local",
        isFlagged: Boolean(user?.isFlagged),
        riskScore: Number(user?.riskScore ?? 0),
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        location: s.location,
        createdAt: s.createdAt
      };
    });
}

/** Helper — send a single SSE frame. */
function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  // ── Auth guard ──────────────────────────────────────────────────────────
  const current = await auth.api.getSession({ headers: await headers() });
  if (!current) {
    return new Response("Unauthorized", { status: 401 });
  }

  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim());
  if (adminEmails.length > 0 && !adminEmails.includes(current.user.email)) {
    return new Response("Forbidden", { status: 403 });
  }

  await connectMongoose();

  // Remember the newest log _id we've already sent so we can do tail-style queries.
  const newest = await SecurityLog.findOne({}).sort({ _id: -1 }).select("_id").lean();
  let lastId: mongoose.Types.ObjectId | null = newest ? newest._id as mongoose.Types.ObjectId : null;

  // Initial snapshot of the last 50 logs + sessions.
  const [initialLogs, initialSessions] = await Promise.all([
    SecurityLog.find({}).sort({ timestamp: -1 }).limit(50).lean(),
    buildSnapshot()
  ]);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // ── Initial full-state frame ──────────────────────────────────────
      controller.enqueue(
        encoder.encode(
          frame("init", {
            logs: initialLogs.map(serializeLog),
            sessions: initialSessions
          })
        )
      );

      // ── Poll loop ─────────────────────────────────────────────────────
      // Poll every 3 s for new log documents and every 15 s for session updates.
      let tick = 0;
      const POLL_MS = 3_000;
      const SESSION_EVERY = 5; // refresh sessions every 5 ticks = 15 s

      const interval = setInterval(async () => {
        try {
          tick++;

          // Fetch any logs created after lastId
          const query = lastId ? { _id: { $gt: lastId } } : {};
          const newLogs = await SecurityLog.find(query).sort({ _id: 1 }).lean();

          if (newLogs.length > 0) {
            lastId = newLogs[newLogs.length - 1]._id as mongoose.Types.ObjectId;
            controller.enqueue(
              encoder.encode(
                frame("logs", newLogs.map(serializeLog))
              )
            );
          }

          // Periodically push a fresh session snapshot so the globe stays live.
          if (tick % SESSION_EVERY === 0) {
            const sessions = await buildSnapshot();
            controller.enqueue(encoder.encode(frame("sessions", sessions)));
          }

          // Keep-alive comment so proxies don't close idle connections.
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch (err) {
          console.error("[SSE stream] poll error:", err);
        }
      }, POLL_MS);

      // Clean up when the client disconnects.
      return () => clearInterval(interval);
    },

    cancel() {
      // The ReadableStream cancel hook is invoked when the client disconnects.
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no" // tell nginx not to buffer
    }
  });
}
