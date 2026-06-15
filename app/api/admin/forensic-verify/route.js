import { NextResponse } from "next/server";
import { getBlockchainLogCount, getBlockchainLog, anchorSecurityLog } from "@/lib/blockchainLogger";

export const runtime = "nodejs";

// Placeholder database logs representing the state stored in the central database.
// To demonstrate forensic verification, we configure:
// - Index 0: Matches perfectly (VERIFIED)
// - Index 1: Matches perfectly (VERIFIED)
// - Index 2: Omitted from database (LOG_DELETION_DETECTED)
// - Index 3: Mutated in database (riskScore changed to "LOW") (DATA_MUTATION_DETECTED)
const placeholderDatabaseLogs = [
  {
    userId: "user_001",
    action: "EXPIRED_SESSION_REPLAY",
    riskScore: "MEDIUM"
  },
  {
    userId: "user_002",
    action: "SQL_INJECTION_SQLI",
    riskScore: "CRITICAL"
  },
  // Index 2 is intentionally omitted (LOG_DELETION_DETECTED)
  {
    userId: "user_004",
    action: "PRIVILEGE_ESCALATION",
    riskScore: "LOW" // Mutated from "HIGH" to "LOW"
  }
];

/**
 * GET /api/admin/forensic-verify
 * Scans all on-chain audit trails, compares them with local DB entries, and flags discrepancies.
 */
export async function GET() {
  try {
    const onChainCount = await getBlockchainLogCount();
    const verificationLogs = [];
    let integrityScore = 100;
    let overallStatus = "COMPLIANT";
    let flagsRaised = 0;

    for (let i = 0; i < onChainCount; i++) {
      const onChainRecord = await getBlockchainLog(i);
      const dbRecord = placeholderDatabaseLogs[i];

      let status = "VERIFIED";
      let discrepancyDetails = "";

      if (!dbRecord) {
        // Log is entirely missing in DB
        status = "LOG_DELETION_DETECTED";
        discrepancyDetails = `Log entry present on-chain at index ${i} is entirely missing from the central database.`;
        flagsRaised++;
      } else if (
        dbRecord.userId !== onChainRecord.userId ||
        dbRecord.action !== onChainRecord.action ||
        dbRecord.riskScore !== onChainRecord.riskScore
      ) {
        // Log details mismatch
        status = "DATA_MUTATION_DETECTED";
        discrepancyDetails = `Data mismatch at index ${i}. On-chain: [User=${onChainRecord.userId}, Action=${onChainRecord.action}, Risk=${onChainRecord.riskScore}]. DB: [User=${dbRecord.userId}, Action=${dbRecord.action}, Risk=${dbRecord.riskScore}].`;
        flagsRaised++;
      }

      verificationLogs.push({
        index: i,
        onChain: {
          userId: onChainRecord.userId,
          action: onChainRecord.action,
          riskScore: onChainRecord.riskScore,
          timestamp: new Date(onChainRecord.timestamp * 1000).toISOString()
        },
        database: dbRecord ? {
          userId: dbRecord.userId,
          action: dbRecord.action,
          riskScore: dbRecord.riskScore
        } : null,
        status,
        discrepancyDetails
      });
    }

    // Adjust metrics based on failures
    if (flagsRaised > 0) {
      overallStatus = "COMPROMISED";
      integrityScore = Math.max(0, 100 - flagsRaised * 25);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalOnChainRecords: onChainCount,
        totalDatabaseRecords: placeholderDatabaseLogs.length,
        flagsRaised,
        integrityScore,
        overallStatus
      },
      auditTrail: verificationLogs
    });
  } catch (error) {
    console.error("[API forensic-verify] Verification scan failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to perform forensic audit verification scan." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/forensic-verify
 * Dispatches an automated transaction to anchor a new forensic security log.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, action, riskScore } = body;

    if (!userId || !action || !riskScore) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: userId, action, riskScore" },
        { status: 400 }
      );
    }

    const receipt = await anchorSecurityLog(userId, action, riskScore);

    return NextResponse.json({
      success: true,
      message: "Log anchored successfully to blockchain.",
      receipt
    });
  } catch (error) {
    console.error("[API forensic-verify] Failed to anchor log:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to anchor security log to the blockchain." },
      { status: 500 }
    );
  }
}
