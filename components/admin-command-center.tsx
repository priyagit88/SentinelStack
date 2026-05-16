"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, RadioTower, UserPlus, LogIn, LogOut, ShieldAlert, Fingerprint, Bot } from "lucide-react";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

type AdminSession = {
  id: string;
  email: string;
  isFlagged: boolean;
  riskScore: number;
  ipAddress?: string;
  location?: { lat?: number; lon?: number; city?: string; country?: string } | null;
};

type SecurityLog = {
  id: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: string;
  ip: string;
  timestamp: string;
  aiAnalysis?: {
    incident_summary?: string;
    confidence_score?: number;
    recommended_action?: string;
  } | null;
  metadata?: Record<string, unknown>;
};

function getEventIcon(type: string) {
  switch (type) {
    case "LOGIN_SUCCESS": return LogIn;
    case "LOGIN_FAILURE": return ShieldAlert;
    case "REGISTER_SUCCESS": return UserPlus;
    case "REGISTER_FAILURE": return ShieldAlert;
    case "SESSION_REVOKED": return LogOut;
    case "HONEYPOT": return Fingerprint;
    case "BOT_VELOCITY": return RadioTower;
    case "CAPTCHA_FAILED": return Bot;
    case "IMPOSSIBLE_TRAVEL": return AlertTriangle;
    default: return ShieldAlert;
  }
}

export function AdminCommandCenter() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [logs, setLogs] = useState<SecurityLog[]>([]);

  async function load() {
    const response = await fetch("/api/security/admin", { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as { sessions: AdminSession[]; logs: SecurityLog[] };
      setSessions(payload.sessions);
      setLogs(payload.logs);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 15000);
    return () => window.clearInterval(interval);
  }, []);

  const points = sessions.map((session) => ({
    lat: session.location?.lat ?? 0,
    lng: session.location?.lon ?? 0,
    size: session.isFlagged ? 0.65 : 0.32,
    color: session.isFlagged ? "#ef4444" : "#22c55e",
    label: `${session.email} • ${session.location?.city ?? "Unknown"}`
  }));

  const arcs = useMemo(
    () =>
      logs
        .filter((log) => log.type === "IMPOSSIBLE_TRAVEL")
        .map((log) => {
          const metadata = log.metadata as {
            previousLocation?: { lat?: number; lon?: number };
            currentLocation?: { lat?: number; lon?: number };
          };
          return {
            startLat: metadata.previousLocation?.lat,
            startLng: metadata.previousLocation?.lon,
            endLat: metadata.currentLocation?.lat,
            endLng: metadata.currentLocation?.lon,
            color: ["rgba(248,113,113,0.15)", "rgba(248,113,113,0.95)"]
          };
        })
        .filter((arc) => arc.startLat && arc.startLng && arc.endLat && arc.endLng),
    [logs]
  );

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 lg:grid-cols-3">
        <Metric title="Active Sessions" value={sessions.length} icon={RadioTower} />
        <Metric
          title="Flagged Nodes"
          value={sessions.filter((session) => session.isFlagged).length}
          icon={AlertTriangle}
        />
        <Metric
          title="AI Reviewed"
          value={logs.filter((log) => log.aiAnalysis).length}
          icon={BrainCircuit}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="min-h-[560px] overflow-hidden rounded-lg border border-cyan-300/15 bg-slate-950/85">
          <div className="border-b border-cyan-300/10 px-5 py-4">
            <h1 className="text-xl font-semibold text-white">Global Session Intelligence</h1>
          </div>
          <div className="h-[520px]">
            <Globe
              backgroundColor="rgba(2,6,23,0)"
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
              bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
              pointsData={points}
              pointAltitude="size"
              pointColor="color"
              pointRadius={0.42}
              pointLabel="label"
              arcsData={arcs}
              arcColor="color"
              arcStroke={0.8}
              arcDashLength={0.45}
              arcDashGap={0.8}
              arcDashAnimateTime={1800}
              width={860}
              height={520}
            />
          </div>
        </article>

        <article className="rounded-lg border border-cyan-300/15 bg-slate-950/85">
          <div className="border-b border-cyan-300/10 px-5 py-4">
            <h2 className="text-xl font-semibold text-white">Security Feed</h2>
          </div>
          <div className="max-h-[560px] overflow-y-auto p-4">
            <div className="grid gap-3">
              {logs.map((log) => {
                const severe = log.severity === "HIGH" || log.severity === "CRITICAL";
                return (
                  <section
                    key={log.id}
                    className={`rounded-lg border bg-slate-950 p-4 ${
                      severe
                        ? "pulse-danger border-red-300/45"
                        : "border-cyan-300/15"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const Icon = getEventIcon(log.type);
                          return <Icon className={`h-4 w-4 ${severe ? "text-red-400" : "text-cyan-400"}`} />;
                        })()}
                        <span className="text-sm font-semibold text-white">{log.type.replace("_", " ")}</span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          severe ? "bg-red-500/15 text-red-200" : "bg-cyan-500/15 text-cyan-200"
                        }`}
                      >
                        {log.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{log.details}</p>
                    {log.aiAnalysis ? (
                      <div className="mt-3 rounded-md border border-cyan-300/10 bg-cyan-300/5 p-3 text-xs leading-5 text-slate-300">
                        <p className="font-semibold text-cyan-200">
                          Gemini confidence: {log.aiAnalysis.confidence_score}%
                        </p>
                        <p className="mt-1">{log.aiAnalysis.recommended_action}</p>
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs text-slate-500">
                      {log.ip} • {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </section>
                );
              })}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

function Metric({
  title,
  value,
  icon: Icon
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <article className="rounded-lg border border-cyan-300/15 bg-slate-950/80 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">{title}</p>
        <Icon className="h-5 w-5 text-cyan-300" />
      </div>
      <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
    </article>
  );
}
