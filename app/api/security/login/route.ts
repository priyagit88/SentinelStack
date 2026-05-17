import { NextResponse, type NextRequest } from "next/server";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { recordSecurityEvent, getClientIp } from "@/lib/security";
import { verifyCaptcha } from "@/lib/captcha";

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
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }
  const ip = getClientIp(request.headers);

  const captchaOk = await verifyCaptcha(body.captchaToken);
  if (!captchaOk) {
    await recordSecurityEvent({
      type: "CAPTCHA_FAILED",
      severity: "HIGH",
      details: "Login blocked: reCAPTCHA verification failed or score below threshold.",
      ip,
      metadata: { email: body.email, endpoint: "login" },
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
