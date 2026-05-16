"use client";

import Script from "next/script";
import { useEffect, useId, useRef } from "react";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      action?: string;
    }
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function Turnstile({
  onToken,
  action
}: {
  onToken: (token: string) => void;
  action?: string;
}) {
  const containerId = useId().replace(/:/g, "");
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return;

    let cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile) return;
      const el = document.getElementById(containerId);
      if (!el || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(el, {
        sitekey: siteKey,
        action,
        theme: "dark",
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken("")
      });
    };

    if (window.turnstile) {
      render();
    } else {
      const interval = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(interval);
          render();
        }
      }, 100);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // widget might already be gone
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, containerId, action, onToken]);

  if (!siteKey) {
    return (
      <p className="text-xs text-amber-300/80">
        CAPTCHA disabled (set NEXT_PUBLIC_TURNSTILE_SITE_KEY to enable).
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div id={containerId} />
    </>
  );
}
