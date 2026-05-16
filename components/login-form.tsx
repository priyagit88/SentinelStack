"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/security/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? "")
      })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Login failed.");
      setPending(false);
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
        <input
          name="password"
          type="password"
          required
          className="rounded-md border border-cyan-200/20 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
        />
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button
        disabled={isPending}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Sign In
      </button>
    </form>
  );
}
