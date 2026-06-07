import { NextResponse, type NextRequest } from "next/server";
import { getDeceptionToken, logHoneyAction, getFakeProfile } from "@/lib/deception";
import { getClientIp } from "@/lib/security";

export const runtime = "nodejs";

/**
 * POST /api/honey/action
 * Receives attacker action events from the shadow UI and logs them to HoneyLog.
 * Always returns { ok: true } so the attacker believes their actions succeeded.
 */
export async function POST(request: NextRequest) {
  const honeyToken = getDeceptionToken(request.headers);
  if (!honeyToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action?: string; payload?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const ip = getClientIp(request.headers);
  const ua = request.headers.get("user-agent") ?? undefined;

  // Read the honey email cookie (set at login time)
  const cookieHeader = request.headers.get("cookie") ?? "";
  let honeyEmail = "unknown@attacker.local";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name?.trim() === "sentinel-honey-email") {
      honeyEmail = rest.join("=").trim();
      break;
    }
  }

  await logHoneyAction({
    sessionToken: honeyToken,
    userEmail:    honeyEmail,
    ipAddress:    ip,
    userAgent:    ua,
    action:       body.action ?? "UNKNOWN",
    payload:      body.payload ?? {}
  });

  // Return fake "success" to all attacker actions
  return NextResponse.json({ ok: true, message: "Changes saved successfully." });
}
