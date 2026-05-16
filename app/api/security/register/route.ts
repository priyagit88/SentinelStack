import { NextResponse, type NextRequest } from "next/server";
import { isAPIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { connectMongoose } from "@/lib/db";
import { User } from "@/lib/models/user";
import { getClientIp, recordSecurityEvent } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    password?: string;
    website?: string;
    focusToSubmitMs?: number;
  };
  const ip = getClientIp(request.headers);

  if (body.website?.trim()) {
    await recordSecurityEvent({
      type: "HONEYPOT",
      severity: "HIGH",
      details: `Registration honeypot field was populated for ${body.email ?? "unknown email"}.`,
      ip,
      metadata: {
        email: body.email,
        website: body.website,
        focusToSubmitMs: body.focusToSubmitMs
      },
      runAi: false
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const automated = typeof body.focusToSubmitMs === "number" && body.focusToSubmitMs < 1500;

  try {
    const response = await auth.api.signUpEmail({
      body: {
        name: body.name ?? "",
        email: body.email ?? "",
        password: body.password ?? ""
      },
      headers: request.headers,
      asResponse: true
    });

    if (automated && body.email) {
      await connectMongoose();
      const user = await User.findOneAndUpdate(
        { email: body.email },
        { $set: { isFlagged: true }, $inc: { riskScore: 25 } },
        { new: true }
      );

      await recordSecurityEvent({
        userId: user?._id,
        type: "BOT_VELOCITY",
        severity: "MEDIUM",
        details: `Registration submitted in ${body.focusToSubmitMs}ms, below the 1500ms automation threshold.`,
        ip,
        metadata: {
          email: body.email,
          focusToSubmitMs: body.focusToSubmitMs
        },
        runAi: false
      });
    }

    return response;
  } catch (error) {
    const message = isAPIError(error) ? error.message : "Unable to create account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
