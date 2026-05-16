"use client";

import { useEffect, useMemo, useState } from "react";
import { MonitorCheck, ShieldAlert, ShieldCheck, Trash2, AlertTriangle, Key, Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

type ProfileSession = {
  id: string;
  token: string;
  ipAddress: string;
  device: string;
  location?: { city?: string; country?: string; lat?: number; lon?: number } | null;
  createdAt?: string;
  expiresAt?: string;
  isCurrent: boolean;
};

type LinkedAccount = {
  id: string;
  providerId: string;
};

export function ProfileDashboard() {
  const { data, isPending } = authClient.useSession();
  const [sessions, setSessions] = useState<ProfileSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ 
    newPassword: "", 
    confirmPassword: "", 
    otp: "",
    step: "initial" as "initial" | "otp",
    error: "", 
    success: "", 
    loading: false,
    showPassword: false,
    showConfirmPassword: false
  });
  const router = useRouter();

  async function loadSessions() {
    setLoadingSessions(true);
    const response = await fetch("/api/security/sessions", { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as { sessions: ProfileSession[] };
      setSessions(payload.sessions);
    }
    setLoadingSessions(false);
  }

  async function loadAccounts() {
    setLoadingAccounts(true);
    const response = await fetch("/api/security/accounts", { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as { accounts: LinkedAccount[] };
      setAccounts(payload.accounts);
    }
    setLoadingAccounts(false);
  }

  useEffect(() => {
    if (data) {
      void loadSessions();
      void loadAccounts();
    }
  }, [data]);

  async function linkProvider(provider: "google" | "github") {
    await authClient.signIn.social({ provider, callbackURL: "/profile" });
  }

  const risk = Number((data?.user as { riskScore?: number } | undefined)?.riskScore ?? 0);
  const isFlagged = Boolean((data?.user as { isFlagged?: boolean } | undefined)?.isFlagged);
  const status = useMemo(() => {
    if (isFlagged || risk >= 70) return { label: "Elevated Risk", tone: "text-red-200", icon: ShieldAlert };
    if (risk >= 30) return { label: "Under Review", tone: "text-amber-200", icon: ShieldAlert };
    return { label: "Clear", tone: "text-emerald-200", icon: ShieldCheck };
  }, [isFlagged, risk]);

  async function revoke(session: ProfileSession) {
    try {
      await authClient.revokeSession({ token: session.token });
    } catch (e) {
      console.error("Failed to revoke session:", e);
    }
    await loadSessions();
  }

  async function handleDeleteAccount() {
    if (!window.confirm("Are you absolutely sure you want to delete your account? This action cannot be undone and will delete all your data.")) {
      return;
    }
    
    setIsDeleting(true);
    try {
      await authClient.deleteUser();
      await authClient.signOut();
      router.push("/register");
      router.refresh();
    } catch (error) {
      console.error("Failed to delete account:", error);
      alert("Failed to delete account. Please try again.");
      setIsDeleting(false);
    }
  }

  async function handleLinkPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordForm(prev => ({ ...prev, error: "", success: "" }));
    
    const { newPassword, confirmPassword } = passwordForm;
    if (newPassword !== confirmPassword) {
      return setPasswordForm(prev => ({ ...prev, error: "Passwords do not match." }));
    }
    if (newPassword.length < 8) {
      return setPasswordForm(prev => ({ ...prev, error: "Password must be at least 8 characters long." }));
    }
    if (!/[0-9!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return setPasswordForm(prev => ({ ...prev, error: "Password must contain at least one number or special character." }));
    }

    setPasswordForm(prev => ({ ...prev, loading: true }));
    try {
      if (passwordForm.step === "initial") {
        // Step 1: Send OTP
        const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({
          email: data.user.email,
          type: "email-verification"
        });
        if (otpError) throw otpError;
        
        setPasswordForm(prev => ({ ...prev, step: "otp", loading: false, success: "Verification code sent to your email." }));
        return;
      }

      // Step 2: Verify OTP and Set Password
      const client = authClient as any;
      
      // Verify OTP first
      const verifyRes = await client.emailOtp.verifyEmail({
        email: data.user.email,
        otp: passwordForm.otp
      });
      if (verifyRes?.error) throw verifyRes.error;

      // Now link the password
      if (client.user?.linkPassword) {
        await client.user.linkPassword({ newPassword });
      } else if (client.setPassword) {
        await client.setPassword({ newPassword });
      } else {
        throw new Error("Password linking method not found on authClient");
      }
      
      setPasswordForm(prev => ({ 
        ...prev, 
        success: "Identity verified and password successfully linked!", 
        loading: false, 
        newPassword: "", 
        confirmPassword: "",
        otp: "",
        step: "initial"
      }));
      await loadAccounts();
    } catch (error: any) {
      console.error("Failed to link password:", error);
      setPasswordForm(prev => ({ ...prev, error: error.message || "Operation failed. Please try again.", loading: false }));
    }
  }

  if (isPending) {
    return <div className="text-slate-300">Loading profile...</div>;
  }

  if (!data) {
    return <div className="text-slate-300">Sign in to view your SentinelStack profile.</div>;
  }

  const StatusIcon = status.icon;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-[1fr_0.75fr]">
        <article className="rounded-lg border border-cyan-300/15 bg-slate-950/80 p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Identity</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">{data.user.name}</h1>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-slate-400">{data.user.email}</p>
            {data.user.emailVerified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </span>
            )}
          </div>
        </article>
        <article className="rounded-lg border border-cyan-300/15 bg-slate-950/80 p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Security Status</p>
            <StatusIcon className={`h-5 w-5 ${status.tone}`} />
          </div>
          <p className={`mt-4 text-2xl font-semibold ${status.tone}`}>{status.label}</p>
          <p className="mt-2 text-sm text-slate-400">Risk score: {risk}</p>
        </article>
      </section>

      <section className="rounded-lg border border-cyan-300/15 bg-slate-950/80">
        <div className="flex items-center justify-between border-b border-cyan-300/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Active Sessions</h2>
          <MonitorCheck className="h-5 w-5 text-cyan-300" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-slate-400">
              <tr className="border-b border-cyan-300/10">
                <th className="px-5 py-3 font-medium">Device</th>
                <th className="px-5 py-3 font-medium">Network</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingSessions ? (
                <tr>
                  <td className="px-5 py-6 text-slate-400" colSpan={4}>
                    Loading sessions...
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="border-b border-cyan-300/10 last:border-0">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-100">{session.device}</div>
                      {session.isCurrent ? (
                        <span className="mt-2 inline-flex rounded-full border border-cyan-200/40 px-2 py-1 text-xs text-cyan-200 shadow-glow">
                          This Device
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {session.ipAddress} - {session.location?.city ?? "Unknown"},{" "}
                      {session.location?.country ?? "Unknown"}
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      {session.createdAt ? new Date(session.createdAt).toLocaleString() : "Unknown"}
                    </td>
                    <td className="px-5 py-4">
                      {!session.isCurrent ? (
                        <button
                          onClick={() => void revoke(session)}
                          className="inline-flex items-center gap-2 rounded-md bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-200 ring-1 ring-red-300/30 hover:bg-red-500/25"
                        >
                          <Trash2 className="h-4 w-4" />
                          Revoke Access
                        </button>
                      ) : (
                        <span className="text-slate-500">Protected</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-cyan-300/15 bg-slate-950/80">
        <div className="flex items-center justify-between border-b border-cyan-300/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Connected Accounts</h2>
          <svg className="h-5 w-5 text-cyan-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
        </div>
        <div className="p-5 grid gap-4 md:grid-cols-2">
          {loadingAccounts ? (
            <p className="text-sm text-slate-400">Loading accounts...</p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-center gap-3">
                  <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="currentColor" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-white">Google</p>
                    <p className="text-xs text-slate-400">Sign in with Google</p>
                  </div>
                </div>
                {accounts.some(a => a.providerId === "google") ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Connected
                  </span>
                ) : (
                  <button onClick={() => void linkProvider("google")} className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-200">
                    Link Account
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-center gap-3">
                  <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-white">GitHub</p>
                    <p className="text-xs text-slate-400">Sign in with GitHub</p>
                  </div>
                </div>
                {accounts.some(a => a.providerId === "github") ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Connected
                  </span>
                ) : (
                  <button onClick={() => void linkProvider("github")} className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-200">
                    Link Account
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-cyan-300/15 bg-slate-950/80">
        <div className="flex items-center gap-2 border-b border-cyan-300/10 px-5 py-4">
          <Key className="h-5 w-5 text-cyan-300" />
          <h2 className="text-lg font-semibold text-white">Security Settings</h2>
        </div>
        <div className="p-5">
          {loadingAccounts ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : accounts.some(a => a.providerId === "credential") ? (
            <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-sm text-slate-300">Your account already has a password set. You can use your email and password to log in.</p>
            </div>
          ) : (
            <form onSubmit={handleLinkPassword} className="max-w-md space-y-4">
              <p className="text-sm text-slate-400">
                You signed up using a social provider. Create a password to enable email/password login as well.
              </p>
              {passwordForm.error && <p className="text-sm text-red-400">{passwordForm.error}</p>}
              {passwordForm.success && <p className="text-sm text-emerald-400">{passwordForm.success}</p>}
              
              {passwordForm.step === "initial" ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-300">Email Address</label>
                    <input
                      type="email"
                      value={data.user.email}
                      readOnly
                      className="w-full rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-300">New Password</label>
                    <div className="relative">
                      <input
                        type={passwordForm.showPassword ? "text" : "password"}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        required
                        className="w-full rounded-md border border-cyan-300/20 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 pr-10"
                        placeholder="At least 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setPasswordForm(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-300 transition-colors"
                      >
                        {passwordForm.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-300">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={passwordForm.showConfirmPassword ? "text" : "password"}
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        required
                        className="w-full rounded-md border border-cyan-300/20 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 pr-10"
                        placeholder="Confirm password"
                      />
                      <button
                        type="button"
                        onClick={() => setPasswordForm(prev => ({ ...prev, showConfirmPassword: !prev.showConfirmPassword }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-300 transition-colors"
                      >
                        {passwordForm.showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4 rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-purple-400">Step 2: Identity Verification</p>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-300">Enter 6-Digit Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={passwordForm.otp}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, otp: e.target.value.replace(/\D/g, "") }))}
                      required
                      className="w-full rounded-md border border-purple-500/30 bg-slate-900 px-3 py-2 text-center text-xl font-bold tracking-[0.5em] text-white focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      placeholder="000000"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setPasswordForm(prev => ({ ...prev, step: "initial", success: "" }))}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    ← Back to password entry
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={passwordForm.loading}
                className={`w-full rounded-md px-4 py-2 text-sm font-semibold ring-1 ring-inset transition-all disabled:opacity-50 ${
                  passwordForm.step === "initial" 
                    ? "bg-cyan-500/20 text-cyan-100 ring-cyan-500/40 hover:bg-cyan-500/30" 
                    : "bg-purple-500/20 text-purple-100 ring-purple-500/40 hover:bg-purple-500/30"
                }`}
              >
                {passwordForm.loading 
                  ? "Processing..." 
                  : passwordForm.step === "initial" 
                    ? "Verify Email & Link Password" 
                    : "Confirm Verification Code"}
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-red-500/20 bg-red-500/5">
        <div className="flex items-center gap-2 border-b border-red-500/20 px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <h2 className="text-lg font-semibold text-red-200">Danger Zone</h2>
        </div>
        <div className="p-5">
          <p className="mb-4 text-sm text-red-200/80">
            Permanently delete your SentinelStack account, all associated sessions, and security logs. This action is irreversible.
          </p>
          <button
            onClick={() => void handleDeleteAccount()}
            disabled={isDeleting}
            className="rounded-md bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 ring-1 ring-inset ring-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </section>
    </div>
  );
}
