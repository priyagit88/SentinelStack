import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { connectMongoose } from "@/lib/db";
import { User } from "@/lib/models/user";
import { recordSecurityEvent, getClientIp } from "@/lib/security";
import mongoose from "mongoose";

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
  const db = (await connectMongoose()).connection.db;

  try {
    // 2. Block the user
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { isBlocked: true } },
      { new: true }
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Revoke all sessions for this user
    if (db) {
      const userId = user.id || user._id?.toString();
      await db.collection("session").deleteMany({ 
        userId: { $in: [userId, new mongoose.Types.ObjectId(userId)] } 
      });
    }

    // 4. Log the administrative action
    const ip = getClientIp(request.headers);
    await recordSecurityEvent({
      userId: session.user.id,
      type: "ADMIN_ACTION",
      severity: "HIGH",
      details: `Administrator ${session.user.email} blocked access for user: ${email}.`,
      ip,
      metadata: { targetEmail: email }
    });

    return NextResponse.json({ ok: true, message: `User ${email} has been blocked and sessions revoked.` });
  } catch (error) {
    console.error("Failed to block user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
