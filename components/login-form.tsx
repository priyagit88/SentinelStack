"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

async function executeRecaptcha(action: string): Promise<string> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey || typeof window === "undefined") return "";

  // Wait for window.grecaptcha to be loaded and initialized if it isn't yet
  const getGrecaptcha = async (): Promise<any> => {
    if (window.grecaptcha) return window.grecaptcha;
    return new Promise((resolve) => {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.grecaptcha) {
          clearInterval(interval);
          resolve(window.grecaptcha);
        } else if (attempts >= 40) { // Timeout after 4 seconds
          clearInterval(interval);
          resolve(undefined);
        }
      }, 100);
    });
  };

  const grecaptcha = await getGrecaptcha();
  if (!grecaptcha) {
    console.error("reCAPTCHA script failed to load on the window object.");
    return "";
  }

  return new Promise<string>((resolve) => {
    const timer = setTimeout(() => {
      resolve("");
    }, 4000);

    grecaptcha.ready(async () => {
      try {
        const token = await grecaptcha.execute(siteKey, { action });
        clearTimeout(timer);
        resolve(token);
      } catch (err) {
        console.error("reCAPTCHA execution failed:", err);
        clearTimeout(timer);
        resolve("");
      }
    });
  });
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // CAPTCHA FIX: mirror RegisterForm — only enforce CAPTCHA gate when the
  // site key is configured. Avoids confusing dev errors when key is absent.
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);

  async function signInWithProvider(provider: "google" | "github") {
    setPending(true);
    await authClient.signIn.social({ provider, callbackURL: "/profile" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const captchaToken = await executeRecaptcha("login");
    // CAPTCHA FIX: fail fast with a clear UX message when grecaptcha didn't
    // load (cold page, blocked by network, script error). Beats the generic
    // 403 the server would otherwise return.
    if (captchaRequired && !captchaToken) {
      setError("CAPTCHA failed to load. Please refresh and try again.");
      setPending(false);
      return;
    }
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/security/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        captchaToken
      })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Login failed.");
      setPending(false);
      return;
    }

    const result = (await response.json().catch(() => null)) as
      | { twoFactorRedirect?: boolean }
      | null;

    if (result?.twoFactorRedirect) {
      router.push("/two-factor");
      router.refresh();
      return;
    }

    router.push("/profile");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-2 text-sm text-slate-300">
        Email
        <input
          name="email"
          type="email"
          required
          className="rounded-md border border-cyan-200/20 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
        />
      </label>
      <label className="grid gap-2 text-sm text-slate-300">
        Password
        <div className="relative">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            className="w-full rounded-md border border-cyan-200/20 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-300 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button
        disabled={isPending}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Sign In
      </button>

      <div className="relative mt-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-cyan-300/10"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-slate-950 px-2 text-slate-500">Or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => void signInWithProvider("github")}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-slate-800 hover:bg-slate-800 hover:ring-slate-700 transition-all disabled:opacity-60"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          GitHub
        </button>
        <button
          type="button"
          onClick={() => void signInWithProvider("google")}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-slate-800 hover:bg-slate-800 hover:ring-slate-700 transition-all disabled:opacity-60"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="currentColor" />
          </svg>
          Google
        </button>
      </div>
    </form>
  );
}
