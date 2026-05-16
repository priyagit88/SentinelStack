import { GoogleGenAI, Type } from "@google/genai";
import { connectMongoose } from "@/lib/db";
import { Session } from "@/lib/models/session";

export type ThreatAiAnalysis = {
  incident_summary: string;
  confidence_score: number;
  recommended_action: string;
};

const fallbackAnalysis: ThreatAiAnalysis = {
  incident_summary:
    "AI analysis is unavailable, so this incident was classified by deterministic SentinelStack heuristics. Review the anomalous IP, location, device fingerprint, and recent login baseline before taking account action.",
  confidence_score: 72,
  recommended_action: "Trigger Step-up Multi-Factor Authentication Challenge"
};

export async function analyzeThreatWithGemini(args: {
  event: Record<string, unknown>;
  userId?: string;
}): Promise<ThreatAiAnalysis> {
  if (!process.env.GEMINI_API_KEY) return fallbackAnalysis;

  await connectMongoose();
  const history = args.userId
    ? await Session.find({ userId: args.userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("ipAddress userAgent location createdAt")
        .lean()
    : [];

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: JSON.stringify(
                {
                  role:
                    "Act as a Tier 3 Cyber Security Operations Center Specialist evaluating credential anomalies.",
                  task:
                    "Assess whether this suspicious login resembles account takeover, VPN location jumping, shared-device behavior, or benign baseline drift. Consider IP, location, browser footprint, velocity, and the user's past five sessions.",
                  suspicious_event: args.event,
                  recent_successful_login_history: history
                },
                null,
                2
              )
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            incident_summary: {
              type: Type.STRING,
              description:
                "Granular explanation analyzing behavior, browser footprints, historical matching, and takeover likelihood."
            },
            confidence_score: {
              type: Type.INTEGER,
              minimum: 0,
              maximum: 100,
              description: "Probability from 0 to 100 that the event is malicious."
            },
            recommended_action: {
              type: Type.STRING,
              description:
                "Clear SOC action such as force password reset, step-up MFA, revoke sessions, or benign baseline update."
            }
          },
          required: ["incident_summary", "confidence_score", "recommended_action"]
        }
      }
    });

    const text = response.text;
    if (!text) return fallbackAnalysis;

    const parsed = JSON.parse(text) as ThreatAiAnalysis;
    return {
      incident_summary: String(parsed.incident_summary),
      confidence_score: Math.min(100, Math.max(0, Number(parsed.confidence_score))),
      recommended_action: String(parsed.recommended_action)
    };
  } catch {
    return fallbackAnalysis;
  }
}
