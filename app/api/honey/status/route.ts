import { NextResponse, type NextRequest } from "next/server";
import { getDeceptionToken, getFakeProfile, getFakeStats, getFakeActivityFeed } from "@/lib/deception";

export const runtime = "nodejs";

/**
 * GET /api/honey/status
 * Returns fake profile & platform stats to the attacker trapped in the shadow UI.
 */
export async function GET(request: NextRequest) {
  const honeyToken = getDeceptionToken(request.headers);
  if (!honeyToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read the honey email cookie for personalisation
  const cookieHeader = request.headers.get("cookie") ?? "";
  let honeyEmail = "unknown@attacker.local";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name?.trim() === "sentinel-honey-email") {
      honeyEmail = rest.join("=").trim();
      break;
    }
  }

  return NextResponse.json({
    profile:      getFakeProfile(honeyToken),
    stats:        getFakeStats(),
    activityFeed: getFakeActivityFeed(),
    email:        honeyEmail
  });
}
