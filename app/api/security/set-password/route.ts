import { NextResponse, type NextRequest } from "next/server";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { connectMongoose } from "@/lib/db";
import mongoose from "mongoose";

// setPassword exists at runtime but the customSession wrapper in lib/auth.ts
// narrows the inferred API type, so we cast to access it. It links a
// `credential` account (hashed password) for an OAuth-only user that has none.
const api = auth.api as unknown as {
  getSession: typeof auth.api.getSession;
  setPassword: (args: {
    body: { newPassword: string };
    headers: Headers;
  }) => Promise<unknown>;
};

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  const password = body.password?.trim() ?? "";

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const session = await api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const dbInstance = (await connectMongoose()).connection.db;
    if (!dbInstance) throw new Error("Database connection unavailable.");

    const userIdStr = String(session.user.id);
    const userIdObj = mongoose.Types.ObjectId.isValid(userIdStr)
      ? new mongoose.Types.ObjectId(userIdStr)
      : null;
    const userIds = [userIdStr, userIdObj].filter(Boolean) as Array<
      string | mongoose.Types.ObjectId
    >;

    const credentialAccount = await dbInstance
      .collection("account")
      .findOne({ providerId: "credential", userId: { $in: userIds } });

    if (credentialAccount) {
      return NextResponse.json(
        { error: "A password is already set for this account." },
        { status: 400 }
      );
    }

    // setPassword runs under better-auth's sensitiveSessionMiddleware, which
    // requires a fresh session (default freshAge = 24h). Surface a clear
    // message instead of the raw SESSION_NOT_FRESH error.
    await api.setPassword({
      body: { newPassword: password },
      headers: request.headers
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof APIError
        ? error.message
        : error instanceof Error
        ? error.message
        : "Could not set the password.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
