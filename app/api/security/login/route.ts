import { NextResponse, type NextRequest } from "next/server";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { recordSecurityEvent, getClientIp } from "@/lib/security";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    rememberMe?: boolean;
    captchaToken?: string;
  };
  const ip = getClientIp(request.headers);

  const captcha = await verifyTurnstile(body.captchaToken, ip);
  if (!captcha.ok) {
    await recordSecurityEvent({
      type: "CAPTCHA_FAILED",
      severity: "HIGH",
      details: `Login blocked: ${captcha.reason ?? "CAPTCHA challenge failed"}.`,
      ip,
      metadata: {
        email: body.email,
        errorCodes: captcha.errorCodes,
        endpoint: "login"
      },
      runAi: false
    });
    return NextResponse.json(
      { error: "CAPTCHA verification failed. Please try again." },
      { status: 400 }
    );
  }

  try {
    return await auth.api.signInEmail({
      body: {
        email: body.email ?? "",
        password: body.password ?? "",
        rememberMe: body.rememberMe ?? true
      },
      headers: request.headers,
      asResponse: true
    });
    // Note: when 2FA is enabled, better-auth returns 200 with
    // { twoFactorRedirect: true } in the body and sets a short-lived
    // 2FA cookie. The login form inspects the JSON and redirects to /two-factor.
  } catch (error) {
    await recordSecurityEvent({
      type: "LOGIN_FAILURE",
      severity: "MEDIUM",
      details: `Failed login attempt for email: ${body.email}`,
      ip,
      metadata: { email: body.email }
    });
    const message = error instanceof APIError ? error.message : "Unable to sign in.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
