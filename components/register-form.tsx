"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";

export function RegisterForm() {
  const router = useRouter();
  const firstFocusAt = useRef<number | null>(null);
  const [error, setError] = useState("");
  const [isPending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const focusToSubmitMs = firstFocusAt.current ? Math.round(performance.now() - firstFocusAt.current) : 0;
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      website: String(form.get("website") ?? ""),
      focusToSubmitMs
    };

    if (payload.website.trim()) {
      await fetch("/api/security/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      router.push("/login?registered=1");
      return;
    }

    const response = await fetch("/api/security/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Registration failed.");
      setPending(false);
      return;
    }

    router.push("/profile");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />
      <label className="grid gap-2 text-sm text-slate-300">
        Name
        <input
          name="name"
          required
          onFocus={() => {
            firstFocusAt.current ??= performance.now();
          }}
          className="rounded-md border border-cyan-200/20 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
        />
      </label>
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
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="rounded-md border border-cyan-200/20 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
        />
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button
        disabled={isPending}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Register Securely
      </button>
    </form>
  );
}
