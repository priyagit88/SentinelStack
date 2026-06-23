import { NextResponse, type NextRequest } from "next/server";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { recordSecurityEvent, getClientIp, resolveIpLocation, userAgentToDevice } from "@/lib/security";
import { verifyCaptcha } from "@/lib/captcha";
import { analyzeThreatWithGemini } from "@/lib/threat-ai";
import {
  DECEPTION_COOKIE,
  DECEPTION_THRESHOLD,
  DECEPTION_TTL_SEC,
  logHoneyAction
} from "@/lib/deception";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

const TRUST_DEVICE_COOKIE_NAMES = [
  "better-auth.trust_device",
  "__Secure-better-auth.trust_device"
];

/**
 * Returns a new Headers object with the better-auth trust_device cookies removed
 * from the inbound Cookie header. better-auth's twoFactor plugin reads this cookie
 * and skips the 2FA challenge when it validates — stripping it forces the
 * challenge to fire on every login.
 */
function stripTrustDeviceCookies(originalHeaders: Headers): Headers {
  const headers = new Headers(originalHeaders);
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return headers;

  const remaining = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .filter((c) => {
      const eq = c.indexOf("=");
      const name = eq < 0 ? c : c.slice(0, eq);
      return !TRUST_DEVICE_COOKIE_NAMES.includes(name);
    })
    .join("; ");

  if (remaining) {
    headers.set("cookie", remaining);
  } else {
    headers.delete("cookie");
  }
  return headers;
}

/**
 * Returns a clone of the upstream response with Set-Cookie directives appended
 * that expire any trust_device cookie the browser still has. This ensures the
 * cookie is dropped client-side so it can never be presented again.
 */
function expireTrustDeviceCookies(response: Response): Response {
  const headers = new Headers();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") headers.set(key, value);
  });
  const getSetCookie = (
    response.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  const upstreamSetCookies =
    typeof getSetCookie === "function"
      ? getSetCookie.call(response.headers)
      : response.headers.get("set-cookie")
      ? [response.headers.get("set-cookie") as string]
      : [];
  for (const sc of upstreamSetCookies) headers.append("set-cookie", sc);

  headers.append(
    "set-cookie",
    "better-auth.trust_device=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax"
  );
  headers.append(
    "set-cookie",
    "__Secure-better-auth.trust_device=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure"
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function POST(request: NextRequest) {
  let body: {
    email?: string;
    password?: string;
    rememberMe?: boolean;
    captchaToken?: string;
    focusToSubmitMs?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }
  const ip = getClientIp(request.headers);

  // CAPTCHA FIX: structured result lets us log why verification failed
  // (low score, invalid host, missing token, etc.) into security events.
  const captcha = await verifyCaptcha(body.captchaToken);
  if (!captcha.ok) {
    await recordSecurityEvent({
      type: "CAPTCHA_FAILED",
      severity: "HIGH",
      details: `Login blocked: reCAPTCHA failed (reason=${captcha.reason ?? "unknown"}, score=${captcha.score ?? "n/a"}).`,
      ip,
      metadata: {
        email: body.email,
        endpoint: "login",
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

  try {
    const sanitizedHeaders = stripTrustDeviceCookies(request.headers);
    const signInResponse = await auth.api.signInEmail({
      body: {
        email: body.email ?? "",
        password: body.password ?? "",
        rememberMe: body.rememberMe ?? true
      },
      headers: sanitizedHeaders,
      asResponse: true
    });

    // If the credential check itself failed, better-auth returns a non-2xx
    // Response whose body is { message, code } — note the field is `message`,
    // NOT `error`. Surface that message and skip the (expensive) threat
    // analysis, which is only meaningful for a genuine login. Without this the
    // client fell back to a generic "Login failed." for every wrong password.
    if (!signInResponse.ok) {
      await recordSecurityEvent({
        type: "LOGIN_FAILURE",
        severity: "MEDIUM",
        details: `Failed login attempt for email: ${body.email}`,
        ip,
        metadata: { email: body.email }
      });
      const failBody = (await signInResponse.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;
      return NextResponse.json(
        { error: failBody?.message ?? failBody?.error ?? "Invalid email or password." },
        { status: signInResponse.status }
      );
    }

    // ── Deception Mode AI Gate ──────────────────────────────────────────────
    // Credential check passed. Everything below is best-effort: if any of it
    // throws (Gemini, IP geolocation, DB), we must NOT convert a valid login
    // into a failure — fall through and return the real sign-in response.
    try {
      const location = await resolveIpLocation(ip);
      const ua = request.headers.get("user-agent") ?? undefined;

      const aiResult = await analyzeThreatWithGemini({
        event: {
          type: "LOGIN_SUCCESS",
          email: body.email,
          ip,
          userAgent: ua,
          device: userAgentToDevice(ua),
          location,
          timestamp: new Date().toISOString()
        }
      });

      const isBotVelocity = typeof body.focusToSubmitMs === "number" && body.focusToSubmitMs > 0 && body.focusToSubmitMs < 1500;
      const isAttackerOverride =
        body.email?.toLowerCase().includes("attacker") ||
        body.email === "achintyak.mca25@rvce.edu.in" ||
        isBotVelocity;
      const confidenceScore = isAttackerOverride ? 100 : aiResult.confidence_score;

      if (confidenceScore >= DECEPTION_THRESHOLD) {
        // Generate a unique honeypot session token
        const honeyToken = randomUUID();

        const triggerDetails = isBotVelocity
          ? `Bot velocity detected: Login completed in ${body.focusToSubmitMs}ms (below 1500ms threshold). Routed to shadow environment.`
          : `Attacker intercepted: AI confidence ${confidenceScore}%. Login by ${body.email ?? "unknown"} from ${ip} routed to shadow environment.`;

        // Log the interception to the security event log for admin visibility
        await recordSecurityEvent({
          type: "DECEPTION_MODE_ACTIVATED",
          severity: "HIGH",
          details: triggerDetails,
          ip,
          metadata: {
            email: body.email,
            aiConfidenceScore: confidenceScore,
            aiSummary: isBotVelocity ? "Automated bot login velocity timing anomaly." : aiResult.incident_summary,
            recommendedAction: isBotVelocity ? "Route to shadow environment (Deception Mode)" : aiResult.recommended_action,
            device: userAgentToDevice(ua),
            location
          },
          runAi: false
        });

        // Log the attacker's first action in the honey log
        await logHoneyAction({
          sessionToken: honeyToken,
          userEmail: body.email ?? "unknown",
          ipAddress: ip,
          userAgent: ua,
          location,
          action: "LOGIN",
          payload: { email: body.email },
          aiConfidenceScore: aiResult.confidence_score,
          aiSummary: aiResult.incident_summary
        });

        // Return a response that looks like a successful login but sets a deception cookie
        // and NO real better-auth session cookie so the real account is untouched.
        const deceptionResponse = NextResponse.json(
          { ok: true, deceptionMode: true },
          { status: 200 }
        );
        deceptionResponse.cookies.set({
          name: DECEPTION_COOKIE,
          value: honeyToken,
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: DECEPTION_TTL_SEC
        });
        // Encode email in a second httpOnly cookie so the honeypot page can personalise
        deceptionResponse.cookies.set({
          name: "sentinel-honey-email",
          value: body.email ?? "unknown",
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: DECEPTION_TTL_SEC
        });
        return deceptionResponse;
      }
    } catch (analysisError) {
      console.error(
        "[login] post-auth threat analysis failed (login still succeeds):",
        analysisError
      );
    }

    // ── Normal login path ────────────────────────────────────────────────────
    return expireTrustDeviceCookies(signInResponse);
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
