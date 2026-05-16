import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { connectMongoose } from "@/lib/db";
import { User } from "@/lib/models/user";
import { recordSecurityEvent, getClientIp } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // 1. Auth Guard
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim());
  if (!adminEmails.includes(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email } = (await request.json()) as { email: string };
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  await connectMongoose();

  try {
    // 2. Unblock the user
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { isBlocked: false, riskScore: 0, isFlagged: false } },
      { new: true }
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Log the administrative action
    const ip = getClientIp(request.headers);
    await recordSecurityEvent({
      userId: session.user.id,
      type: "ADMIN_ACTION",
      severity: "LOW",
      details: `Administrator ${session.user.email} unblocked user: ${email}.`,
      ip,
      metadata: { targetEmail: email }
    });

    return NextResponse.json({ ok: true, message: `User ${email} has been unblocked.` });
  } catch (error) {
    console.error("Failed to unblock user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
