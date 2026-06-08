import { NextResponse } from "next/server";
import { anchorSecurityLog } from "@/lib/blockchainLogger";

export const runtime = "nodejs";

/**
 * POST /api/security/trigger-alert
 * Triggers a security alert incident, saves it locally/databases, and anchors it to the on-chain ledger.
 */
export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Malformed JSON request body." },
        { status: 400 }
      );
    }

    const { userId, action, riskScore } = body;

    // Validate inputs
    if (!userId || !action || !riskScore) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: userId, action, riskScore." },
        { status: 400 }
      );
    }

    // =========================================================================
    // DATABASE PERSISTENCE PLACEHOLDER
    // In a live production configuration, we simultaneously save these tracking
    // coordinates to our central database (e.g. MongoDB/Mongoose or PostgreSQL).
    //
    // Example:
    //   await connectMongoose();
    //   const localLog = await SecurityLog.create({
    //     userId,
    //     action,
    //     riskScore,
    //     timestamp: new Date()
    //   });
    // =========================================================================

    console.log(`[API trigger-alert] Triggered alert for ${userId} - anchoring to blockchain...`);

    // Dispatch automated transaction on-chain
    const receipt = await anchorSecurityLog(userId, action, riskScore);

    return NextResponse.json({
      success: true,
      message: "Security incident anchored to blockchain audit trail.",
      receipt
    });
  } catch (error) {
    console.error("[API trigger-alert] Incident trigger failure:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to anchor incident on-chain." },
      { status: 500 }
    );
  }
}
