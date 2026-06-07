import { NextResponse, type NextRequest } from "next/server";

/**
 * Universal trust_device cookie kill-switch.
 *
 * Better-auth's twoFactor plugin honors a 30-day `better-auth.trust_device`
 * cookie and silently skips the TOTP challenge on subsequent /sign-in/email
 * calls when the cookie validates. The hackathon requirement is "every login
 * challenges", so this middleware:
 *
 *   1. Strips `better-auth.trust_device` (and the `__Secure-` variant) from
 *      the inbound Cookie header for every /api/auth/* and /api/security/*
 *      request before better-auth ever sees it. The plugin's `getSignedCookie`
 *      lookup then returns null and the flow falls into the 2FA challenge path.
 *
 *   2. Appends `Set-Cookie: ...trust_device=; Max-Age=0` directives to every
 *      outbound response on those paths, so any cookie already in the browser
 *      from prior sessions is dropped.
 *
 * Catches every auth route — current and future — without each one having to
 * remember to do it itself.
 */

const TRUST_DEVICE_COOKIE_NAMES = [
  "better-auth.trust_device",
  "__Secure-better-auth.trust_device"
];

function stripTrustDeviceFromCookieHeader(cookieHeader: string): string {
  return cookieHeader
    .split(";")
    .map((c) => c.trim())
    .filter((c) => {
      if (!c) return false;
      const eq = c.indexOf("=");
      const name = eq < 0 ? c : c.slice(0, eq);
      return !TRUST_DEVICE_COOKIE_NAMES.includes(name);
    })
    .join("; ");
}

export function middleware(request: NextRequest) {
  // Build modified request headers without trust_device cookies, so the route
  // handler (and better-auth's internal cookie lookup) cannot read them.
  const newRequestHeaders = new Headers(request.headers);
  const cookieHeader = newRequestHeaders.get("cookie");
  if (cookieHeader) {
    const stripped = stripTrustDeviceFromCookieHeader(cookieHeader);
    if (stripped) {
      newRequestHeaders.set("cookie", stripped);
    } else {
      newRequestHeaders.delete("cookie");
    }
  }

  const response = NextResponse.next({
    request: { headers: newRequestHeaders }
  });

  // Expire both cookie names on every outbound auth response so the browser
  // drops them. Expiring a non-existent cookie is a no-op.
  response.cookies.set({
    name: "better-auth.trust_device",
    value: "",
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax"
  });
  response.cookies.set({
    name: "__Secure-better-auth.trust_device",
    value: "",
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true
  });

  // ── Deception Mode Protection ──────────────────────────────────────────
  const isHoneyPath = request.nextUrl.pathname.startsWith("/honeypot") || 
                      request.nextUrl.pathname.startsWith("/api/honey");
  
  if (isHoneyPath) {
    const honeyToken = request.cookies.get("sentinel-deception-mode")?.value;
    if (!honeyToken) {
      // Attacker trying to deep-link into honeypot without a token
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Allow honeypot access
    return response;
  }

  return response;
}

export const config = {
  // Run on auth-relevant paths and honeypot routes
  matcher: [
    "/api/auth/:path*", 
    "/api/security/:path*",
    "/honeypot/:path*",
    "/api/honey/:path*"
  ]
};
