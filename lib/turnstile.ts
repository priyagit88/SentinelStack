const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  errorCodes?: string[];
};

export async function verifyTurnstile(token: string | undefined, ip: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    return { ok: true, skipped: true, reason: "TURNSTILE_SECRET_KEY not set" };
  }

  if (!token) {
    return { ok: false, skipped: false, reason: "Missing CAPTCHA token" };
  }

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (ip && ip !== "127.0.0.1") form.set("remoteip", ip);

    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store"
    });

    const data = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (data.success) return { ok: true, skipped: false };
    return {
      ok: false,
      skipped: false,
      reason: "CAPTCHA verification failed",
      errorCodes: data["error-codes"]
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      reason: error instanceof Error ? error.message : "CAPTCHA network error"
    };
  }
}
