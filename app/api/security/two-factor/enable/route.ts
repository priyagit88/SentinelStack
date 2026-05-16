import { NextResponse, type NextRequest } from "next/server";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { connectMongoose } from "@/lib/db";
import mongoose from "mongoose";

// Plugin endpoints (setPassword, enableTwoFactor) exist at runtime but the
// customSession wrapper in lib/auth.ts narrows the inferred API type, so we
// cast to access them.
const api = auth.api as unknown as {
  getSession: typeof auth.api.getSession;
  setPassword: (args: {
    body: { newPassword: string };
    headers: Headers;
  }) => Promise<unknown>;
  enableTwoFactor: (args: {
    body: { password: string; issuer?: string };
    headers: Headers;
  }) => Promise<{ totpURI: string; backupCodes: string[] }>;
};

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { password?: string };
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
    await connectMongoose();
    const dbInstance = (await connectMongoose()).connection.db;
    if (!dbInstance) throw new Error("Database connection unavailable.");

    const userIdStr = String(session.user.id);
    const userIdObj = mongoose.Types.ObjectId.isValid(userIdStr)
      ? new mongoose.Types.ObjectId(userIdStr)
      : null;
    const userIds = [userIdStr, userIdObj].filter(Boolean) as Array<string | mongoose.Types.ObjectId>;

    const credentialAccount = await dbInstance
      .collection("account")
      .findOne({ providerId: "credential", userId: { $in: userIds } });

    if (!credentialAccount) {
      await api.setPassword({
        body: { newPassword: password },
        headers: request.headers
      });
    }

    const result = await api.enableTwoFactor({
      body: { password },
      headers: request.headers
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof APIError
        ? error.message
        : error instanceof Error
        ? error.message
        : "Could not enable two-factor authentication.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
