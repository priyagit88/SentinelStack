import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { connectMongoose } from "@/lib/db";
import { SecurityLog } from "@/lib/models/security-log";
import { analyzeThreatWithGemini } from "@/lib/threat-ai";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim());
  if (!adminEmails.includes(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { logId } = (await request.json()) as { logId: string };
  if (!logId) return NextResponse.json({ error: "logId is required" }, { status: 400 });

  await connectMongoose();
  const log = await SecurityLog.findById(logId);
  if (!log) return NextResponse.json({ error: "Log not found" }, { status: 404 });

  // If already analyzed, just return it
  if (log.aiAnalysis) return NextResponse.json({ ok: true, aiAnalysis: log.aiAnalysis });

  try {
    const aiAnalysis = await analyzeThreatWithGemini({
      event: {
        type: log.type,
        severity: log.severity,
        details: log.details,
        ip: log.ip,
        timestamp: (log.timestamp ?? new Date()).toString(),
        metadata: log.metadata ?? {}
      },
      userId: log.userId?.toString()
    });

    log.aiAnalysis = aiAnalysis;
    await log.save();

    return NextResponse.json({ ok: true, aiAnalysis });
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
