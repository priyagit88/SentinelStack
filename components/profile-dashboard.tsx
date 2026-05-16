"use client";

import { useEffect, useMemo, useState } from "react";
import { MonitorCheck, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

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

export function ProfileDashboard() {
  const { data, isPending } = authClient.useSession();
  const [sessions, setSessions] = useState<ProfileSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  async function loadSessions() {
    setLoadingSessions(true);
    const response = await fetch("/api/security/sessions", { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as { sessions: ProfileSession[] };
      setSessions(payload.sessions);
    }
    setLoadingSessions(false);
  }

  useEffect(() => {
    if (data) void loadSessions();
  }, [data]);

  const risk = Number((data?.user as { riskScore?: number } | undefined)?.riskScore ?? 0);
  const isFlagged = Boolean((data?.user as { isFlagged?: boolean } | undefined)?.isFlagged);
  const status = useMemo(() => {
    if (isFlagged || risk >= 70) return { label: "Elevated Risk", tone: "text-red-200", icon: ShieldAlert };
    if (risk >= 30) return { label: "Under Review", tone: "text-amber-200", icon: ShieldAlert };
    return { label: "Clear", tone: "text-emerald-200", icon: ShieldCheck };
  }, [isFlagged, risk]);

  async function revoke(session: ProfileSession) {
    const client = authClient as unknown as {
      session?: { revoke?: (args: { id: string }) => Promise<unknown> };
      revokeSession?: (args: { token: string }) => Promise<unknown>;
    };

    if (client.session?.revoke) {
      await client.session.revoke({ id: session.id });
    } else if (client.revokeSession) {
      await client.revokeSession({ token: session.token });
    }

    await loadSessions();
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
          <p className="mt-2 text-slate-400">{data.user.email}</p>
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
    </div>
  );
}
