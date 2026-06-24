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

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// llama-3.3-70b-versatile is the best quality/limits balance on Groq's free
// tier. Override with GROQ_MODEL (e.g. "openai/gpt-oss-120b") for max quality.
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const SYSTEM_PROMPT =
  "You are a Tier 3 Security Operations Center analyst evaluating credential anomalies " +
  "(account takeover, VPN/location jumping, shared-device behaviour, or benign baseline drift). " +
  "Consider the IP, geolocation, browser footprint, velocity, and the user's recent sessions. " +
  "Respond with ONLY a single JSON object (no prose, no markdown) with EXACTLY these keys: " +
  "who (string — one sentence: the account email/user, source IP, and city/country if known), " +
  "what (string — one sentence: what happened and why it is or isn't risky), " +
  "when (string — one sentence: the time plus any timing anomaly such as off-hours access, rapid retries, or impossible travel), " +
  "confidence_score (integer 0-100 — probability the event is malicious), " +
  "recommended_action (string — e.g. force password reset, step-up MFA, revoke sessions, or benign baseline update).";

/**
 * AI threat triage via Groq (OpenAI-compatible chat completions, JSON mode).
 * Falls back to deterministic heuristics if GROQ_API_KEY is unset or the call
 * fails/times out, so callers never need to handle an error.
 */
export async function analyzeThreat(args: {
  event: Record<string, unknown>;
  userId?: string;
}): Promise<ThreatAiAnalysis> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return fallbackAnalysis;

  try {
    let history: unknown[] = [];
    if (args.userId) {
      await connectMongoose();
      history = await Session.find({ userId: args.userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("ipAddress userAgent location createdAt")
        .lean();
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify(
              { suspicious_event: args.event, recent_successful_login_history: history },
              null,
              2
            )
          }
        ]
      })
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      console.error("[threat-ai] Groq HTTP", res.status, await res.text().catch(() => ""));
      return fallbackAnalysis;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return fallbackAnalysis;

    const parsed = JSON.parse(text) as ThreatAiAnalysis;
    return {
      who: String(parsed.who ?? ""),
      what: String(parsed.what ?? parsed.incident_summary ?? ""),
      when: String(parsed.when ?? ""),
      confidence_score: Math.min(100, Math.max(0, Number(parsed.confidence_score) || 0)),
      recommended_action: String(parsed.recommended_action ?? fallbackAnalysis.recommended_action)
    };
  } catch (err) {
    console.error("[threat-ai] Groq analysis failed:", err);
    return fallbackAnalysis;
  }
}
