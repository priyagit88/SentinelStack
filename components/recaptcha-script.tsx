import Script from "next/script";

/**
 * Loads Google reCAPTCHA v3 only on pages that need it (login / register),
 * non-blocking. Previously this lived in the root layout with
 * strategy="beforeInteractive", which loaded the heavy Google script on every
 * page and delayed interactivity site-wide. Returns null when no site key is
 * configured (e.g. local dev), matching the forms' graceful-degradation path.
 */
export function RecaptchaScript() {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) return null;
  return (
    <Script
      src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
      strategy="afterInteractive"
    />
  );
}
