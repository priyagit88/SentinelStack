import crypto from "crypto";

// HMAC-signed admin session cookie. Replaces the old plaintext `admin_wallet`
// cookie (which the server merely checked for presence and was trivially
// spoofable). This token is issued ONLY after the server has (1) verified a
// wallet signature proving ownership of the address and (2) confirmed that
// address holds ADMIN_ROLE on-chain — see /api/admin/verify-wallet. The HMAC is
// keyed with BETTER_AUTH_SECRET, so it can't be forged client-side.

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_TTL_SEC = 15 * 60; // 15 minutes

function secret(): string {
  return process.env.BETTER_AUTH_SECRET || "insecure-dev-secret-change-me";
}

export function signAdminSession(
  address: string,
  ttlSec: number = ADMIN_SESSION_TTL_SEC
): string {
  const payload = Buffer.from(
    JSON.stringify({ address: address.toLowerCase(), exp: Date.now() + ttlSec * 1000 })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAdminSession(token: string | undefined): { address: string } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      address?: string;
      exp?: number;
    };
    if (!data.address || !data.exp || data.exp < Date.now()) return null;
    return { address: data.address };
  } catch {
    return null;
  }
}
