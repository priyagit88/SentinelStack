"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, KeyRound, SmartphoneNfc } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Mode = "totp" | "backup";

export function TwoFactorChallenge() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const { error: err } =
        mode === "totp"
          ? await authClient.twoFactor.verifyTotp({ 
              code, 
              trustDevice 
            })
          : await authClient.twoFactor.verifyBackupCode({ 
              code, 
              trustDevice 
            });

      if (err) {
        setError(err.message ?? "Invalid code. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/profile");
      router.refresh();
    } catch (err: any) {
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <div className="grid gap-2">
        <label htmlFor="2fa-code" className="flex items-center gap-2 text-sm font-medium text-slate-300">
          {mode === "totp" ? (
            <><SmartphoneNfc className="h-4 w-4 text-cyan-400" /> Authenticator Code</>
          ) : (
            <><KeyRound className="h-4 w-4 text-cyan-400" /> Backup Recovery Code</>
          )}
        </label>
        <input
          id="2fa-code"
          inputMode={mode === "totp" ? "numeric" : "text"}
          pattern={mode === "totp" ? "[0-9]*" : undefined}
          maxLength={mode === "totp" ? 6 : 12}
          autoFocus
          required
          autoComplete="one-time-code"
          value={code}
          onChange={(e) =>
            setCode(mode === "totp" ? e.target.value.replace(/\D/g, "") : e.target.value)
          }
          placeholder={mode === "totp" ? "000000" : "Enter backup code"}
          className="w-full rounded-xl border border-cyan-500/20 bg-slate-900/50 px-4 py-4 text-center text-2xl font-bold tracking-[0.2em] text-white placeholder:text-slate-700 outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50 transition-all shadow-inner"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="trustDevice"
          checked={trustDevice}
          onChange={(e) => setTrustDevice(e.target.checked)}
          className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-950"
        />
        <label htmlFor="trustDevice" className="text-sm text-slate-400 cursor-pointer select-none">
          Remember this device for 30 days
        </label>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400 ring-1 ring-inset ring-red-500/20">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || code.length < 6}
        className="group btn-slide w-full"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <ShieldCheck className="h-5 w-5 transition-transform group-hover:scale-110" />
            Verify Account
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "totp" ? "backup" : "totp");
          setCode("");
          setError("");
        }}
        className="text-sm font-medium text-slate-500 hover:text-cyan-400 transition-colors"
      >
        {mode === "totp" ? "Lost your device? Use a backup code" : "Back to authenticator app"}
      </button>
    </form>
  );
}
