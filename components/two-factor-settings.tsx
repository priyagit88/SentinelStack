"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldOff,
  Loader2,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  LockKeyhole,
  Smartphone,
  Fingerprint,
  KeyRound,
  Trash2,
  Plus
} from "lucide-react";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";

type Phase =
  | "idle"
  | "choose"
  | "totp-password"
  | "totp-scan"
  | "totp-backup"
  | "totp-disable"
  | "passkey";

type PasskeyItem = {
  id: string;
  name?: string;
  deviceType?: string;
  createdAt?: string | Date;
};

export function TwoFactorSettings({ hasPassword = true }: { hasPassword?: boolean }) {
  const { data, isPending, refetch } = authClient.useSession();
  const totpEnabled = Boolean(
    (data?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Passkey state
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [passkeyName, setPasskeyName] = useState("");
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // better-auth's passkey client methods aren't in the inferred type because of
  // the customSession wrapper, so we cast at the call sites below.
  type PasskeyApi = {
    passkey: {
      listUserPasskeys: () => Promise<{ data?: PasskeyItem[] | null; error?: { message?: string } | null }>;
      addPasskey: (opts: { name?: string }) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
      deletePasskey: (opts: { id: string }) => Promise<{ error?: { message?: string } | null }>;
    };
  };
  const passkeyApi = authClient as unknown as PasskeyApi;

  const loadPasskeys = useCallback(async () => {
    try {
      const res = await (authClient as unknown as PasskeyApi).passkey.listUserPasskeys();
      if (!res.error && Array.isArray(res.data)) {
        setPasskeys(res.data);
      }
    } catch {
      // non-fatal — the panel still works without the list
    }
  }, []);

  useEffect(() => {
    if (data) void loadPasskeys();
  }, [data, loadPasskeys]);

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
    setPasskeyName("");
    setPasskeyLoading(false);
  }

  const passkeyCount = passkeys.length;
  const anyMfa = totpEnabled || passkeyCount > 0;

  // ── TOTP (authenticator app) ──────────────────────────────────────────────
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
      setPhase("totp-scan");
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
    const { error: err } = await authClient.twoFactor.verifyTotp({
      code,
      trustDevice: true
    });
    setLoading(false);
    if (err) {
      setError(err.message ?? "Invalid verification code.");
      return;
    }
    setPhase("totp-backup");
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

  // ── Passkey (WebAuthn / security key) ─────────────────────────────────────
  async function registerPasskey(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPasskeyLoading(true);
    try {
      const res = await passkeyApi.passkey.addPasskey({
        name: passkeyName.trim() || "My passkey"
      });
      if (res.error) {
        setError(res.error.message ?? "Could not register passkey.");
        setPasskeyLoading(false);
        return;
      }
      setPasskeyName("");
      await loadPasskeys();
      await refetch();
      setPhase("idle");
    } catch (err) {
      // Thrown when the user dismisses the browser WebAuthn prompt.
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Passkey registration was cancelled."
          : "Passkey registration failed. Your device may not support it."
      );
    } finally {
      setPasskeyLoading(false);
    }
  }

  async function removePasskey(id: string) {
    setError("");
    setDeletingId(id);
    try {
      const res = await passkeyApi.passkey.deletePasskey({ id });
      if (res.error) {
        setError(res.error.message ?? "Could not remove passkey.");
      } else {
        await loadPasskeys();
        await refetch();
      }
    } finally {
      setDeletingId(null);
    }
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
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
              anyMfa
                ? "bg-emerald-500/10 ring-emerald-500/30 text-emerald-400"
                : "bg-slate-800 ring-slate-700 text-slate-500"
            }`}
          >
            {anyMfa ? <ShieldCheck className="h-6 w-6" /> : <ShieldOff className="h-6 w-6" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Multi-Factor Authentication</h3>
            <p className="mt-1 max-w-lg text-sm leading-relaxed text-slate-400">
              {anyMfa
                ? "Your account is protected. You can add more methods or manage existing ones below."
                : "Add an extra layer of security. Choose an authenticator app (TOTP) or a passkey / security key — or set up both."}
            </p>
          </div>
        </div>

        {phase === "idle" && (
          <button
            onClick={() => {
              setError("");
              setPhase("choose");
            }}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition-all hover:bg-cyan-300 hover:scale-[1.02]"
          >
            {anyMfa ? "Add MFA method" : "Enable MFA"}
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Overview of configured methods ── */}
      {phase === "idle" && anyMfa && (
        <div className="mt-6 space-y-3">
          <div className="h-px bg-white/5" />
          <div className="flex items-center justify-between rounded-lg bg-white/5 p-4 ring-1 ring-inset ring-white/5">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-cyan-400" />
              <div>
                <p className="text-sm font-semibold text-white">Authenticator app</p>
                <p className="text-xs text-slate-400">
                  {totpEnabled ? "Enabled — codes from your authenticator app" : "Not configured"}
                </p>
              </div>
            </div>
            {totpEnabled ? (
              <button
                onClick={() => setPhase("totp-disable")}
                className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/20"
              >
                Disable
              </button>
            ) : (
              <button
                onClick={() => setPhase("totp-password")}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
              >
                Set up
              </button>
            )}
          </div>

          <div className="rounded-lg bg-white/5 p-4 ring-1 ring-inset ring-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Fingerprint className="h-5 w-5 text-cyan-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Passkeys / security keys</p>
                  <p className="text-xs text-slate-400">
                    {passkeyCount > 0
                      ? `${passkeyCount} registered`
                      : "Not configured"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPhase("passkey")}
                className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            {passkeyCount > 0 && (
              <ul className="mt-3 space-y-2">
                {passkeys.map((pk) => (
                  <li
                    key={pk.id}
                    className="flex items-center justify-between rounded-md bg-slate-950/50 px-3 py-2 ring-1 ring-inset ring-white/5"
                  >
                    <span className="flex items-center gap-2 text-sm text-slate-200">
                      <KeyRound className="h-4 w-4 text-slate-500" />
                      {pk.name || "Unnamed passkey"}
                    </span>
                    <button
                      onClick={() => removePasskey(pk.id)}
                      disabled={deletingId === pk.id}
                      className="rounded p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                      aria-label="Remove passkey"
                    >
                      {deletingId === pk.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error && <p className="text-sm font-medium text-red-400">{error}</p>}
        </div>
      )}

      {/* ── Method chooser (AWS-style) ── */}
      {phase === "choose" && (
        <div className="mt-8 animate-in fade-in slide-in-from-top-4">
          <div className="mb-6 h-px bg-white/5" />
          <p className="mb-5 text-center text-sm text-slate-300">
            Select an MFA method to add. You can configure both.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={() => setPhase(totpEnabled ? "totp-disable" : "totp-password")}
              className="group flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-5 text-left transition-all hover:border-cyan-400/40 hover:bg-slate-900/60"
            >
              <Smartphone className="h-8 w-8 text-cyan-400" />
              <div>
                <p className="font-bold text-white">Authenticator app</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Use a TOTP app like Google or Microsoft Authenticator to generate codes.
                </p>
              </div>
              <span className="mt-1 text-xs font-semibold text-cyan-400">
                {totpEnabled ? "Enabled — manage" : "Set up"}
                <ChevronRight className="ml-0.5 inline h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>

            <button
              onClick={() => setPhase("passkey")}
              className="group flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-5 text-left transition-all hover:border-cyan-400/40 hover:bg-slate-900/60"
            >
              <Fingerprint className="h-8 w-8 text-cyan-400" />
              <div>
                <p className="font-bold text-white">Security key / Passkey</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Phishing-resistant sign-in with a hardware key, fingerprint, or device unlock.
                </p>
              </div>
              <span className="mt-1 text-xs font-semibold text-cyan-400">
                {passkeyCount > 0 ? `${passkeyCount} registered — add more` : "Set up"}
                <ChevronRight className="ml-0.5 inline h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          </div>
          <button
            onClick={reset}
            className="mx-auto mt-5 flex items-center gap-1 text-sm text-slate-500 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        </div>
      )}

      {/* ── Passkey registration ── */}
      {phase === "passkey" && (
        <div className="mt-8 animate-in fade-in slide-in-from-top-4">
          <div className="mb-6 h-px bg-white/5" />
          <form onSubmit={registerPasskey} className="mx-auto max-w-sm space-y-4">
            <div className="flex justify-center">
              <Fingerprint className="h-10 w-10 text-cyan-400 opacity-60" />
            </div>
            <p className="text-center text-sm text-slate-300">
              Give this passkey a name, then follow your browser&apos;s prompt to register your
              security key, fingerprint, or device.
            </p>
            <input
              type="text"
              placeholder="e.g. My laptop, YubiKey"
              autoFocus
              value={passkeyName}
              onChange={(e) => setPasskeyName(e.target.value)}
              maxLength={48}
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50"
            />
            {error && <p className="text-center text-sm font-medium text-red-400">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={passkeyLoading}
                className="flex-1 rounded-lg bg-cyan-400 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                {passkeyLoading ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Register passkey"
                )}
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

      {/* ── TOTP: confirm password ── */}
      {phase === "totp-password" && (
        <div className="mt-8 animate-in fade-in slide-in-from-top-4">
          <div className="mb-6 h-px bg-white/5" />
          <form onSubmit={startEnable} className="mx-auto max-w-sm space-y-4">
            <div className="mb-4 flex justify-center">
              <LockKeyhole className="h-10 w-10 text-cyan-400 opacity-50" />
            </div>
            <p className="text-center text-sm text-slate-300">
              {hasPassword
                ? "Confirm your identity to begin the setup process."
                : "Set a password to secure authenticator-based sign-in."}
            </p>
            <input
              type="password"
              placeholder={hasPassword ? "Enter current password" : "Create a password"}
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50"
            />
            {error && <p className="text-center text-sm font-medium text-red-400">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-cyan-400 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Continue"}
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

      {/* ── TOTP: scan QR ── */}
      {phase === "totp-scan" && (
        <div className="mt-8 animate-in fade-in zoom-in-95">
          <div className="mb-8 h-px bg-white/5" />
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/20 text-xs font-bold text-cyan-400">
                  1
                </div>
                <h4 className="font-bold text-white">Scan the QR code</h4>
              </div>
              <p className="text-sm leading-relaxed text-slate-400">
                Open your authenticator app and scan this code to link your account. Keep this code
                secret and do not share it.
              </p>

              <div className="inline-block overflow-hidden rounded-xl bg-[#ffffff] p-4 shadow-2xl ring-8 ring-white/5">
                {qrImage ? (
                  <img src={qrImage} alt="Setup QR" className="h-48 w-48" />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center bg-slate-100 italic text-slate-400">
                    Generating...
                  </div>
                )}
              </div>

              <p className="block text-xs text-slate-500">
                Manual setup key:{" "}
                <span className="font-mono text-slate-400">
                  {totpUri.split("secret=")[1]?.split("&")[0] || "••••••••"}
                </span>
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/20 text-xs font-bold text-cyan-400">
                  2
                </div>
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
                  className="w-full rounded-xl bg-cyan-400 py-4 font-mono text-sm font-bold text-slate-950 transition-all hover:bg-cyan-300 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  ) : (
                    "Verify & Activate"
                  )}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="w-full text-sm text-slate-500 hover:text-white"
                >
                  Cancel activation
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── TOTP: backup codes ── */}
      {phase === "totp-backup" && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="mb-6 h-px bg-white/5" />
          <div className="rounded-xl bg-amber-500/10 p-5 ring-1 ring-inset ring-amber-500/20">
            <h4 className="flex items-center gap-2 font-bold text-amber-200">
              <Smartphone className="h-4 w-4" /> Authenticator app enabled!
            </h4>
            <p className="mt-2 text-sm text-amber-200/80">
              Setup is complete. Please save these codes now. If you lose your phone, these are the
              only way back into your account.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {backupCodes.map((c) => (
              <div
                key={c}
                className="rounded-lg bg-white/5 p-3 text-center font-mono text-sm text-slate-300 ring-1 ring-white/5"
              >
                {c}
              </div>
            ))}
          </div>

          <div className="mt-8 flex gap-4">
            <button
              onClick={copyCodes}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-700"
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

      {/* ── TOTP: disable ── */}
      {phase === "totp-disable" && (
        <div className="mt-8 animate-in fade-in slide-in-from-top-4">
          <div className="mb-6 h-px bg-white/5" />
          <form onSubmit={startDisable} className="mx-auto max-w-sm space-y-4 text-center">
            <ShieldOff className="mx-auto h-12 w-12 text-red-400 opacity-50" />
            <div>
              <h4 className="text-lg font-bold text-white">Disable authenticator app?</h4>
              <p className="mt-2 text-sm text-slate-400">
                This removes TOTP from your account. Other MFA methods stay active.
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
                {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Disable"}
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
    </div>
  );
}
