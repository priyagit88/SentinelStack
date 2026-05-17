/**
 * Verifies a Google reCAPTCHA v3 token via Google's siteverify endpoint.
 * Returns true ONLY when Google reports success AND the score is at least 0.5.
 *
 * Missing tokens or server secrets fail closed. Authentication routes should
 * not continue unless the token was verified server-side.
 */
export async function verifyCaptcha(token: string | undefined): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!token) return false;
  if (!secret) return false;

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
    return Boolean(data.success && (data.score ?? 0) >= 0.5);
  } catch {
    return false;
  }
}
