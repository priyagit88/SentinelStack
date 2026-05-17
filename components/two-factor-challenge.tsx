"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Mode = "totp" | "backup";

export function TwoFactorChallenge() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } =
      mode === "totp"
        ? await authClient.twoFactor.verifyTotp({ code, trustDevice: false })
        : await authClient.twoFactor.verifyBackupCode({ code, trustDevice: false });
    setLoading(false);
    if (err) {
      setError(err.message ?? "Invalid code. Try again.");
      return;
    }
    router.push("/profile");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-2 text-sm text-slate-300">
        {mode === "totp" ? "6-digit code" : "Backup code"}
        <input
          inputMode={mode === "totp" ? "numeric" : "text"}
          pattern={mode === "totp" ? "[0-9]*" : undefined}
          maxLength={mode === "totp" ? 6 : 12}
          autoFocus
          required
          value={code}
          onChange={(e) =>
            setCode(mode === "totp" ? e.target.value.replace(/\D/g, "") : e.target.value)
          }
          className="rounded-md border border-cyan-200/20 bg-slate-950 px-4 py-3 text-center text-xl tracking-[0.4em] text-white outline-none focus:border-cyan-300"
        />
      </label>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button
        type="submit"
        disabled={loading || code.length < (mode === "totp" ? 6 : 6)}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Verify
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "totp" ? "backup" : "totp");
          setCode("");
          setError("");
        }}
        className="inline-flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-cyan-300"
      >
        <KeyRound className="h-3.5 w-3.5" />
        {mode === "totp" ? "Use a backup code instead" : "Use authenticator code instead"}
      </button>
    </form>
  );
}
