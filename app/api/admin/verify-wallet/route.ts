import { NextResponse, type NextRequest } from "next/server";
import { ethers } from "ethers";
import { SentinelAccessABI } from "@/lib/abis/SentinelAccess";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SEC,
  signAdminSession
} from "@/lib/admin-session";

export const runtime = "nodejs";

const FRESHNESS_MS = 5 * 60 * 1000; // signed message must be < 5 min old

/**
 * Proves the caller controls an admin wallet, then issues a tamper-proof session
 * cookie. Steps:
 *   1. Recover the signer from (message, signature) — proves wallet ownership.
 *   2. Check the message's "Issued At" timestamp is fresh (anti-replay).
 *   3. Read isAdmin(signer) from the SentinelAccess contract on-chain.
 * Only then is an HMAC-signed admin_session cookie set.
 */
export async function POST(request: NextRequest) {
  const { message, signature } = (await request.json().catch(() => ({}))) as {
    message?: string;
    signature?: string;
  };
  if (!message || !signature) {
    return NextResponse.json({ error: "Missing message or signature." }, { status: 400 });
  }

  // 1. Recover signer
  let signer: string;
  try {
    signer = ethers.verifyMessage(message, signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  // 2. Freshness (anti-replay) — message must embed a recent ISO timestamp.
  const issuedMatch = /Issued At:\s*(\S+)/.exec(message);
  const issuedAt = issuedMatch ? Date.parse(issuedMatch[1]) : NaN;
  if (Number.isNaN(issuedAt) || Math.abs(Date.now() - issuedAt) > FRESHNESS_MS) {
    return NextResponse.json({ error: "Signature expired. Please reconnect." }, { status: 401 });
  }
  // Bind the signature to this signer (defense against message reuse).
  if (!message.toLowerCase().includes(signer.toLowerCase())) {
    return NextResponse.json({ error: "Signed message does not match wallet." }, { status: 401 });
  }

  // 3. On-chain ADMIN_ROLE check
  const contractAddress = process.env.NEXT_PUBLIC_SENTINEL_ACCESS_CONTRACT;
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
  if (!contractAddress || !rpcUrl) {
    return NextResponse.json(
      { error: "Admin access contract is not configured." },
      { status: 500 }
    );
  }
  let isAdmin = false;
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, SentinelAccessABI, provider);
    isAdmin = await contract.isAdmin(signer);
  } catch (err) {
    console.error("[verify-wallet] on-chain isAdmin check failed:", err);
    return NextResponse.json({ error: "Could not verify admin role on-chain." }, { status: 502 });
  }
  if (!isAdmin) {
    return NextResponse.json(
      { error: "This wallet does not hold the on-chain ADMIN_ROLE." },
      { status: 403 }
    );
  }

  // 4. Issue the signed, httpOnly session cookie.
  const res = NextResponse.json({ ok: true, address: signer });
  res.cookies.set(ADMIN_SESSION_COOKIE, signAdminSession(signer), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SEC,
    secure: process.env.NODE_ENV === "production"
  });
  return res;
}

// Clears the admin session (used by the Disconnect button).
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
