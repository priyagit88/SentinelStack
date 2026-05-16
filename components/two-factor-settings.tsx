"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Loader2, KeyRound, Copy, Check } from "lucide-react";
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
    QRCode.toDataURL(totpUri, { width: 220, margin: 1 })
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
        setError(json?.error ?? "Could not start two-factor setup.");
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
    const { error: err } = await authClient.twoFactor.verifyTotp({ code });
    setLoading(false);
    if (err) {
      setError(err.message ?? "Invalid code. Try again.");
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
      <div className="rounded-lg border border-cyan-300/10 bg-slate-950/40 p-5">
        <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
      </div>
    );
  }

  const isFirstTimePasswordSetup = !hasPassword && !enabled;
  const passwordLabel = isFirstTimePasswordSetup
    ? "Create a password (used to confirm changes & 2FA enrollment)"
    : "Confirm your password to begin setup";

  return (
    <div className="rounded-lg border border-cyan-300/10 bg-slate-950/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {enabled ? (
            <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-300" />
          ) : (
            <ShieldOff className="h-6 w-6 shrink-0 text-slate-400" />
          )}
          <div>
            <h3 className="text-base font-semibold text-white">Two-Factor Authentication</h3>
            <p className="mt-1 text-sm text-slate-400">
              {enabled
                ? "Active — sign-ins require a 6-digit code from your authenticator app."
                : "Add an extra layer of security using Google Authenticator, Authy, or any TOTP app."}
            </p>
          </div>
        </div>
        {phase === "idle" && (
          <button
            onClick={() => setPhase(enabled ? "disable" : "password")}
            className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold ${
              enabled
                ? "bg-red-500/10 text-red-200 ring-1 ring-inset ring-red-400/30 hover:bg-red-500/20"
                : "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
            }`}
          >
            {enabled ? "Disable" : "Enable"}
          </button>
        )}
      </div>

      {phase === "password" && (
        <form onSubmit={startEnable} className="mt-5 grid gap-3 border-t border-cyan-300/10 pt-5">
          {isFirstTimePasswordSetup && (
            <p className="text-xs text-slate-400">
              You signed in with Google/GitHub. Pick a password (min 8 characters) — it will be
              attached to your account so 2FA can verify it&apos;s you. You can still keep using
              social sign-in.
            </p>
          )}
          <label className="grid gap-2 text-sm text-slate-300">
            {passwordLabel}
            <input
              type="password"
              autoFocus
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-cyan-200/20 bg-slate-950 px-4 py-2.5 text-white outline-none focus:border-cyan-300"
            />
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Continue
            </button>
            <button type="button" onClick={reset} className="rounded-md px-4 py-2 text-sm text-slate-400 hover:text-white">
              Cancel
            </button>
          </div>
        </form>
      )}

      {phase === "scan" && (
        <div className="mt-5 grid gap-4 border-t border-cyan-300/10 pt-5">
          <p className="text-sm text-slate-300">
            Scan this QR code with Google Authenticator (or any TOTP app), then enter the 6-digit
            code it shows.
          </p>
          {qrImage ? (
            <div className="flex justify-center rounded-md bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrImage} alt="Two-factor QR code" width={220} height={220} />
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-md border border-cyan-300/10 bg-slate-900 p-8 text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating QR code...
            </div>
          )}
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer">Can&apos;t scan? Show setup key</summary>
            <code className="mt-2 block break-all rounded bg-slate-900 p-2 font-mono text-slate-300">
              {totpUri || "—"}
            </code>
          </details>
          <form onSubmit={verifyEnable} className="grid gap-3">
            <label className="grid gap-2 text-sm text-slate-300">
              6-digit code
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="rounded-md border border-cyan-200/20 bg-slate-950 px-4 py-2.5 text-center text-xl tracking-[0.5em] text-white outline-none focus:border-cyan-300"
              />
            </label>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="inline-flex items-center gap-2 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Verify &amp; Enable
              </button>
              <button type="button" onClick={reset} className="rounded-md px-4 py-2 text-sm text-slate-400 hover:text-white">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {phase === "backup-codes" && (
        <div className="mt-5 grid gap-3 border-t border-cyan-300/10 pt-5">
          <div className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-200 ring-1 ring-inset ring-amber-400/30">
            Save these backup codes in a safe place. Each can be used once if you lose your
            authenticator.
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-900 p-3 font-mono text-sm text-slate-200">
            {backupCodes.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyCodes}
              className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy codes"}
            </button>
            <button
              onClick={reset}
              className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {phase === "disable" && (
        <form onSubmit={startDisable} className="mt-5 grid gap-3 border-t border-cyan-300/10 pt-5">
          <label className="grid gap-2 text-sm text-slate-300">
            Confirm your password to disable two-factor
            <input
              type="password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-cyan-200/20 bg-slate-950 px-4 py-2.5 text-white outline-none focus:border-cyan-300"
            />
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 ring-1 ring-inset ring-red-400/30 hover:bg-red-500/30 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
              Disable Two-Factor
            </button>
            <button type="button" onClick={reset} className="rounded-md px-4 py-2 text-sm text-slate-400 hover:text-white">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
