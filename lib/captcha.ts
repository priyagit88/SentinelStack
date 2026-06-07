/**
 * Verifies a Google reCAPTCHA v3 token via Google's siteverify endpoint.
 *
 * Returns a structured result so callers can record WHY a verification failed
 * (token missing, secret missing, network error, Google rejected the token,
 * score below threshold, etc.). The diagnostic info is logged server-side
 * and is invaluable when debugging production CAPTCHA issues on Vercel.
 *
 * Score threshold is configurable via the RECAPTCHA_MIN_SCORE env var.
 * Default 0.3 — deliberately permissive because fresh v3 keys score
 * legitimate users 0.3-0.5 during Google's first-week calibration. Raise
 * to 0.5 once the key has steady traffic.
 */
export type CaptchaResult = {
  ok: boolean;
  skipped: boolean;
  score?: number;
  action?: string;
  errorCodes?: string[];
  reason?: string;
};

const DEFAULT_MIN_SCORE = 0.3;

function parseMinScore(): number {
  const raw = process.env.RECAPTCHA_MIN_SCORE;
  if (!raw) return DEFAULT_MIN_SCORE;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) return DEFAULT_MIN_SCORE;
  return parsed;
}

export async function verifyCaptcha(token: string | undefined): Promise<CaptchaResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  // No server secret configured: skip verification gracefully so local dev
  // without CAPTCHA keys still works. Production MUST set RECAPTCHA_SECRET_KEY.
  if (!secret) {
    return { ok: true, skipped: true, reason: "secret-not-configured" };
  }

  if (!token) {
    return { ok: false, skipped: false, reason: "missing-token" };
  }

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);

    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store"
    });
    const data = (await res.json()) as {
      success?: boolean;
      score?: number;
      action?: string;
      "error-codes"?: string[];
    };

    const minScore = parseMinScore();
    const score = data.score ?? 0;
    const ok = Boolean(data.success) && score >= minScore;

    if (!ok) {
      // Server-side only (never returned to client). Surfaces in Vercel logs.
      console.warn("[captcha] verification failed", {
        success: data.success,
        score,
        action: data.action,
        errorCodes: data["error-codes"],
        minScore
      });
    }

    return {
      ok,
      skipped: false,
      score,
      action: data.action,
      errorCodes: data["error-codes"],
      reason: ok
        ? undefined
        : !data.success
        ? "google-rejected"
        : "low-score"
    };
  } catch (error) {
    console.warn("[captcha] network error", error);
    return {
      ok: false,
      skipped: false,
      reason: error instanceof Error ? error.message : "network-error"
    };
  }
}
