import { NextResponse, type NextRequest } from "next/server";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { connectMongoose } from "@/lib/db";
import { User } from "@/lib/models/user";
import { getClientIp, recordSecurityEvent } from "@/lib/security";
import { verifyCaptcha } from "@/lib/captcha";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: {
    name?: string;
    email?: string;
    password?: string;
    website?: string;
    focusToSubmitMs?: number;
    captchaToken?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }
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
      runAi: true
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const captchaOk = await verifyCaptcha(body.captchaToken);
  if (!captchaOk) {
    await recordSecurityEvent({
      type: "CAPTCHA_FAILED",
      severity: "HIGH",
      details: "Registration blocked: reCAPTCHA verification failed or score below threshold.",
      ip,
      metadata: {
        email: body.email,
        endpoint: "register"
      },
      runAi: false
    });
    return NextResponse.json(
      { error: "CAPTCHA verification failed. Please try again." },
      { status: 403 }
    );
  }

  const automated = typeof body.focusToSubmitMs === "number" && body.focusToSubmitMs < 1500;

  if (body.email) {
    await connectMongoose();
    const existingUser = await User.findOne({ email: body.email });
    if (existingUser) {
      const db = (await connectMongoose()).connection.db;
      if (db) {
        const account = await db.collection("account").findOne({
          userId: existingUser.id || existingUser._id?.toString(),
          providerId: { $in: ["google", "github"] }
        });
        if (account) {
          return NextResponse.json(
            { error: "This email is registered via Social Login (Google/GitHub). Please sign in using your provider." },
            { status: 400 }
          );
        }
      }
    }
  }

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

    // Normalize better-auth's error format ({ message, code }) into { error }
    // so the register form can display a real reason instead of a generic fallback.
    if (!response.ok) {
      let normalizedMessage = "Unable to create account.";
      try {
        const errBody = (await response.clone().json()) as
          | { message?: string; error?: string; code?: string }
          | null;
        normalizedMessage =
          errBody?.error ?? errBody?.message ?? normalizedMessage;
      } catch {
        // body wasn't JSON — keep fallback
      }
      return NextResponse.json(
        { error: normalizedMessage },
        { status: response.status }
      );
    }

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
        runAi: true
      });
    }

    return response;
  } catch (error) {
    await recordSecurityEvent({
      type: "REGISTER_FAILURE",
      severity: "MEDIUM",
      details: `Failed registration attempt for email: ${body.email}`,
      ip,
      metadata: { email: body.email }
    });
    const message = error instanceof APIError ? error.message : "Unable to create account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
