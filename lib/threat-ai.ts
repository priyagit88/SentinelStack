import { GoogleGenAI, Type } from "@google/genai";
import { connectMongoose } from "@/lib/db";
import { Session } from "@/lib/models/session";

export type ThreatAiAnalysis = {
  who: string;
  what: string;
  when: string;
  confidence_score: number;
  recommended_action: string;
  // Retained for backward-compat with events analyzed before the structured
  // who/what/when fields existed; the UI falls back to it when present.
  incident_summary?: string;
};

const fallbackAnalysis: ThreatAiAnalysis = {
  who: "Actor could not be resolved by AI; see the source IP and account email on the event.",
  what: "AI analysis is unavailable, so this incident was classified by deterministic SentinelStack heuristics.",
  when: "See the event timestamp. Review for off-hours access or rapid repeated attempts.",
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
                    "Assess whether this event resembles account takeover, VPN location jumping, shared-device behavior, or benign baseline drift. Consider IP, location, browser footprint, velocity, and the user's past five sessions. Summarize for a SOC analyst as four concise fields — who (the actor: account email, source IP and geolocation), what (what action occurred and why it is or isn't risky), when (the time it occurred plus any timing anomaly such as off-hours access, rapid retries, or impossible travel), and a recommended_action.",
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
            who: {
              type: Type.STRING,
              description:
                "The actor in one sentence: account email/user, source IP, and geolocation (city/country) if known."
            },
            what: {
              type: Type.STRING,
              description:
                "What happened in one sentence and why it is or isn't risky (takeover, location jump, shared device, benign drift)."
            },
            when: {
              type: Type.STRING,
              description:
                "When it occurred plus any timing anomaly (off-hours access, rapid retries, impossible-travel velocity). One sentence."
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
          required: ["who", "what", "when", "confidence_score", "recommended_action"]
        }
      }
    });

    const text = response.text;
    if (!text) return fallbackAnalysis;

    const parsed = JSON.parse(text) as ThreatAiAnalysis;
    return {
      who: String(parsed.who ?? ""),
      what: String(parsed.what ?? parsed.incident_summary ?? ""),
      when: String(parsed.when ?? ""),
      confidence_score: Math.min(100, Math.max(0, Number(parsed.confidence_score))),
      recommended_action: String(parsed.recommended_action)
    };
  } catch {
    return fallbackAnalysis;
  }
}
