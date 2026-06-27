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
    worldIdProof?: {
      merkle_root: string;
      nullifier_hash: string;
      proof: string;
      verification_level: string;
    };
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

  // CAPTCHA FIX: structured result enables production diagnostics in security logs.
  const captcha = await verifyCaptcha(body.captchaToken);
  if (!captcha.ok) {
    await recordSecurityEvent({
      type: "CAPTCHA_FAILED",
      severity: "HIGH",
      details: `Registration blocked: reCAPTCHA failed (reason=${captcha.reason ?? "unknown"}, score=${captcha.score ?? "n/a"}).`,
      ip,
      metadata: {
        email: body.email,
        endpoint: "register",
        captchaReason: captcha.reason,
        captchaScore: captcha.score,
        captchaAction: captcha.action,
        captchaErrorCodes: captcha.errorCodes
      },
      runAi: false
    });
    return NextResponse.json(
      { error: "CAPTCHA verification failed. Please try again." },
      { status: 403 }
    );
  }

  // World ID verification (server-side proof verification)
  let worldIdNullifier: string | null = null;
  const worldIdAppId = process.env.WORLD_ID_APP_ID as `app_${string}` | undefined;
  const worldIdAction = process.env.WORLD_ID_ACTION || "sentinel_register";

  // World ID is REQUIRED for new account registration. Existing accounts log in
  // through a separate flow that never touches World ID, so they are unaffected.
  if (worldIdAppId && !body.worldIdProof) {
    await recordSecurityEvent({
      type: "WORLD_ID_REQUIRED",
      severity: "MEDIUM",
      details: `Registration blocked: World ID proof missing for ${body.email ?? "unknown"}.`,
      ip,
      metadata: { email: body.email, endpoint: "register" },
      runAi: false
    });
    return NextResponse.json(
      { error: "World ID verification is required to create a new account." },
      { status: 400 }
    );
  }

  if (body.worldIdProof && worldIdAppId) {
    try {
      const { verifyCloudProof } = await import("@worldcoin/idkit");
      const verifyRes = (await verifyCloudProof(body.worldIdProof as any, worldIdAppId, worldIdAction)) as any;

      if (!verifyRes.success) {
        await recordSecurityEvent({
          type: "WORLD_ID_FAILED",
          severity: "HIGH",
          details: `World ID verification failed for ${body.email ?? "unknown"}.`,
          ip,
          metadata: { email: body.email },
          runAi: false
        });
        return NextResponse.json(
          { error: "World ID verification failed. Please try again." },
          { status: 400 }
        );
      }

      // Check if this World ID nullifier has already been used
      await connectMongoose();
      const existingNullifier = await User.findOne({ worldIdNullifier: verifyRes.nullifier_hash });
      if (existingNullifier) {
        return NextResponse.json(
          { error: "This World ID has already been used to register an account." },
          { status: 409 }
        );
      }

      worldIdNullifier = verifyRes.nullifier_hash;
    } catch (err) {
      console.error("[register] World ID verification error:", err);
      // Don't block registration if World ID verification service is down,
      // but log it as a security event
      await recordSecurityEvent({
        type: "WORLD_ID_ERROR",
        severity: "MEDIUM",
        details: `World ID verification service error during registration for ${body.email ?? "unknown"}.`,
        ip,
        metadata: { email: body.email, error: String(err) },
        runAi: false
      });
    }
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

    // Update user with World ID fields after successful creation
    if (worldIdNullifier && body.email) {
      await connectMongoose();
      await User.updateOne(
        { email: body.email },
        {
          $set: {
            worldIdNullifier,
            isVerifiedHuman: true
          }
        }
      );
    }

    // DEMO BYPASS: Auto-verify any email containing "attacker" so we don't need real OTP/emails
    if (body.email && body.email.toLowerCase().includes("attacker")) {
      await connectMongoose();
      const dbInstance = (await connectMongoose()).connection.db;
      if (dbInstance) {
        await dbInstance.collection("user").updateOne(
          { email: body.email.toLowerCase() },
          { $set: { emailVerified: true } }
        );
      }
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
