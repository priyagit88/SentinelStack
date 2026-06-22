"use client";

import { useEffect, useState } from "react";
import { 
  ShieldCheck, 
  ShieldOff, 
  Loader2, 
  KeyRound, 
  Copy, 
  Check, 
  ChevronRight, 
  LockKeyhole,
  Smartphone
} from "lucide-react";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";

type Phase = "idle" | "password" | "scan" | "backup-codes" | "disable";

export function TwoFactorSettings({ hasPassword = true }: { hasPassword?: boolean }) {
  const { data, isPending, refetch } = authClient.useSession();
  const enabled = Boolean((data?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled);

  const [phase, setPhase] = useState<Phase>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!totpUri) {
      setQrImage("");
      return;
    }
    QRCode.toDataURL(totpUri, { 
      width: 240, 
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" }
    })
      .then(setQrImage)
      .catch(() => setQrImage(""));
  }, [totpUri]);

  function reset() {
    setPhase("idle");
    setPassword("");
    setCode("");
    setQrImage("");
    setTotpUri("");
    setBackupCodes([]);
    setError("");
    setLoading(false);
    setCopied(false);
  }

  async function startEnable(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/security/two-factor/enable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Authentication failed.");
        setLoading(false);
        return;
      }
      setTotpUri(json?.totpURI ?? "");
      setBackupCodes(json?.backupCodes ?? []);
      setPhase("scan");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyEnable(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    // Explicitly pass trustDevice: true for the enabling user's current session
    const { error: err } = await authClient.twoFactor.verifyTotp({ 
      code, 
      trustDevice: true 
    });
    setLoading(false);
    if (err) {
      setError(err.message ?? "Invalid verification code.");
      return;
    }
    setPhase("backup-codes");
    await refetch();
  }

  async function startDisable(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await authClient.twoFactor.disable({ password });
    setLoading(false);
    if (err) {
      setError(err.message ?? "Could not disable two-factor.");
      return;
    }
    reset();
    await refetch();
  }

  function copyCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (isPending) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl bg-slate-900/50">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/5 bg-slate-900/30 p-6 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-6">
        <div className="flex gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
            enabled ? "bg-emerald-500/10 ring-emerald-500/30 text-emerald-400" : "bg-slate-800 ring-slate-700 text-slate-500"
          }`}>
            {enabled ? <ShieldCheck className="h-6 w-6" /> : <ShieldOff className="h-6 w-6" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Two-Factor Authentication</h3>
            <p className="mt-1 max-w-lg text-sm leading-relaxed text-slate-400">
              {enabled
                ? "Your account is protected with TOTP. New sign-ins will require a code from your authenticator app."
                : "Secure your account by requiring an additional verification step. You can use apps like Google Authenticator or Microsoft Authenticator."}
            </p>
          </div>
        </div>
        
        {phase === "idle" && (
          <button
            onClick={() => setPhase(enabled ? "disable" : "password")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${
              enabled
                ? "bg-red-500/10 text-red-300 hover:bg-red-500/20 ring-1 ring-red-500/30"
                : "bg-cyan-400 text-slate-950 hover:bg-cyan-300 hover:scale-[1.02]"
            }`}
          >
            {enabled ? "Manage Security" : "Enable MFA"}
            {!enabled && <ChevronRight className="h-4 w-4" />}
          </button>
        )}
      </div>

      {phase === "password" && (
        <div className="mt-8 animate-in fade-in slide-in-from-top-4">
          <div className="mb-6 h-px bg-white/5" />
          <form onSubmit={startEnable} className="mx-auto max-w-sm space-y-4">
             <div className="flex justify-center mb-4">
                <LockKeyhole className="h-10 w-10 text-cyan-400 opacity-50" />
             </div>
             <p className="text-center text-sm text-slate-300">
               Confirm your identity to begin the setup process.
             </p>
            <div className="grid gap-2">
              <input
                type="password"
                placeholder="Enter current password"
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50"
              />
            </div>
            {error && <p className="text-center text-sm font-medium text-red-400">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-cyan-400 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Verify Password"}
              </button>
              <button 
                type="button" 
                onClick={reset} 
                className="flex-1 rounded-lg bg-slate-800 py-3 text-sm font-bold text-white hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {phase === "scan" && (
        <div className="mt-8 animate-in fade-in zoom-in-95">
          <div className="mb-8 h-px bg-white/5" />
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/20 text-xs font-bold text-cyan-400">1</div>
                 <h4 className="font-bold text-white">Scan the QR code</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Open your authenticator app and scan this code to link your account. 
                Keep this code secret and do not share it.
              </p>
              
              <div className="overflow-hidden rounded-xl bg-white p-4 inline-block ring-8 ring-white/5 shadow-2xl">
                {qrImage ? (
                  <img src={qrImage} alt="Setup QR" className="h-48 w-48" />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center bg-slate-100 italic text-slate-400">
                    Generating...
                  </div>
                )}
              </div>
              
              <button 
                type="button"
                onClick={() => setTotpUri(totpUri ? "" : totpUri)} 
                className="block text-xs text-slate-500 hover:text-cyan-400"
              >
                Manual setup key: <span className="font-mono">{totpUri.split("secret=")[1]?.split("&")[0] || "••••••••"}</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/20 text-xs font-bold text-cyan-400">2</div>
                 <h4 className="font-bold text-white">Enter verification code</h4>
              </div>
              <p className="text-sm text-slate-400">
                Type the 6-digit code shown in your app to confirm enrollment.
              </p>
              
              <form onSubmit={verifyEnable} className="space-y-4">
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  placeholder="000 000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-4 text-center text-3xl font-bold tracking-[0.25em] text-cyan-400 outline-none focus:border-cyan-400/50"
                />
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full rounded-xl bg-cyan-400 py-4 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 transition-all font-mono"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Verify & Activate"}
                </button>
                <button type="button" onClick={reset} className="w-full text-sm text-slate-500 hover:text-white">
                  Cancel activation
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {phase === "backup-codes" && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="mb-6 h-px bg-white/5" />
          <div className="rounded-xl bg-amber-500/10 p-5 ring-1 ring-inset ring-amber-500/20">
            <h4 className="flex items-center gap-2 font-bold text-amber-200">
               <Smartphone className="h-4 w-4" /> MFA is Enabled!
            </h4>
            <p className="mt-2 text-sm text-amber-200/80">
              Setup is complete. Please save these codes now. If you lose your phone, these are the only way back into your account.
            </p>
          </div>
          
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {backupCodes.map((c) => (
              <div key={c} className="rounded-lg bg-white/5 p-3 text-center font-mono text-sm text-slate-300 ring-1 ring-white/5">
                {c}
              </div>
            ))}
          </div>
          
          <div className="mt-8 flex gap-4">
            <button
              onClick={copyCodes}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-3 text-sm font-bold text-white hover:bg-slate-700 transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied to Clipboard" : "Copy Recovery Codes"}
            </button>
            <button
              onClick={reset}
              className="rounded-lg bg-cyan-400 px-8 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300"
            >
              Finish Setup
            </button>
          </div>
        </div>
      )}

      {phase === "disable" && (
        <div className="mt-8 animate-in fade-in slide-in-from-top-4">
          <div className="mb-6 h-px bg-white/5" />
          <form onSubmit={startDisable} className="mx-auto max-w-sm space-y-4 text-center">
            <ShieldOff className="mx-auto h-12 w-12 text-red-400 opacity-50" />
            <div>
              <h4 className="text-lg font-bold text-white">Disable Protection?</h4>
              <p className="text-sm text-slate-400 mt-2">
                This will remove the extra security layer from your account.
              </p>
            </div>
            <input
              type="password"
              placeholder="Confirm password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-red-500/20 bg-slate-950 px-4 py-3 text-white outline-none focus:border-red-500/50"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-red-500/20 py-3 text-sm font-bold text-red-400 ring-1 ring-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Disable MFA"}
              </button>
              <button type="button" onClick={reset} className="flex-1 rounded-lg bg-slate-800 py-3 text-sm font-bold text-white hover:bg-slate-700">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
