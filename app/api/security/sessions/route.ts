import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { connectMongoose } from "@/lib/db";
import mongoose from "mongoose";
import { Session } from "@/lib/models/session";
import { userAgentToDevice } from "@/lib/security";

export const runtime = "nodejs";

export async function GET() {
  const current = await auth.api.getSession({ headers: await headers() });

  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectMongoose();
  const userIdObj = mongoose.Types.ObjectId.isValid(current.user.id) 
    ? new mongoose.Types.ObjectId(current.user.id) 
    : null;

  const sessions = await Session.find({
    userId: { $in: [current.user.id, userIdObj].filter(Boolean) },
    expiresAt: { $gt: new Date() }
  })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    currentSessionId: current.session.id,
    sessions: sessions.map((session) => ({
      id: session.id ?? session._id.toString(),
      token: session.token,
      ipAddress: session.ipAddress ?? "Unknown IP",
      userAgent: session.userAgent ?? "Unknown device",
      device: userAgentToDevice(session.userAgent),
      location: typeof session.location === "string" 
        ? JSON.parse(session.location) 
        : (session.location ?? null),
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent:
        session.id === current.session.id ||
        session.token === (current.session as { token?: string }).token
    }))
  });
}
