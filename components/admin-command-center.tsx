"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  RadioTower,
  UserPlus,
  LogIn,
  LogOut,
  ShieldAlert,
  Fingerprint,
  Wifi,
  WifiOff,
  Zap
} from "lucide-react";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

// ─── Types ───────────────────────────────────────────────────────────────────

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

type ConnectionStatus = "connecting" | "live" | "error" | "closed";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEventIcon(type: string) {
  switch (type) {
    case "LOGIN_SUCCESS":    return LogIn;
    case "LOGIN_FAILURE":    return ShieldAlert;
    case "REGISTER_SUCCESS": return UserPlus;
    case "REGISTER_FAILURE": return ShieldAlert;
    case "SESSION_REVOKED":  return LogOut;
    case "HONEYPOT":         return Fingerprint;
    case "BOT_VELOCITY":     return RadioTower;
    case "IMPOSSIBLE_TRAVEL":return AlertTriangle;
    default:                 return ShieldAlert;
  }
}

function severityClass(severity: string) {
  switch (severity) {
    case "CRITICAL": return "border-red-400/50 bg-red-500/8 shadow-[0_0_12px_rgba(239,68,68,0.12)]";
    case "HIGH":     return "border-orange-400/40 bg-orange-500/8 shadow-[0_0_8px_rgba(249,115,22,0.10)]";
    case "MEDIUM":   return "border-yellow-400/30 bg-yellow-500/5";
    default:         return "border-cyan-300/15 bg-slate-950";
  }
}

function severityBadge(severity: string) {
  switch (severity) {
    case "CRITICAL": return "bg-red-500/20 text-red-300 ring-1 ring-red-500/30";
    case "HIGH":     return "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/30";
    case "MEDIUM":   return "bg-yellow-500/15 text-yellow-200";
    default:         return "bg-cyan-500/15 text-cyan-200";
  }
}

function iconClass(severity: string) {
  switch (severity) {
    case "CRITICAL": return "text-red-400";
    case "HIGH":     return "text-orange-400";
    case "MEDIUM":   return "text-yellow-400";
    default:         return "text-cyan-400";
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminCommandCenter() {
  const [sessions, setSessions]             = useState<AdminSession[]>([]);
  const [logs, setLogs]                     = useState<SecurityLog[]>([]);
  const [status, setStatus]                 = useState<ConnectionStatus>("connecting");
  const [newCount, setNewCount]             = useState(0);
  const [flashIds, setFlashIds]             = useState<Set<string>>(new Set());
  const feedRef                             = useRef<HTMLDivElement>(null);
  const esRef                               = useRef<EventSource | null>(null);
  const initialised                         = useRef(false);

  // ── SSE connection ──────────────────────────────────────────────────────
  useEffect(() => {
    function connect() {
      setStatus("connecting");
      const es = new EventSource("/api/security/stream");
      esRef.current = es;

      es.addEventListener("init", (e: MessageEvent) => {
        const payload = JSON.parse(e.data as string) as {
          logs: SecurityLog[];
          sessions: AdminSession[];
        };
        setSessions(payload.sessions);
        setLogs(payload.logs);
        setStatus("live");
        initialised.current = true;
      });

      es.addEventListener("logs", (e: MessageEvent) => {
        const incoming = JSON.parse(e.data as string) as SecurityLog[];
        if (!incoming.length) return;

        // Prepend newest events, cap list at 100
        setLogs(prev => {
          const merged = [...incoming.reverse(), ...prev].slice(0, 100);
          return merged;
        });

        // Bump unread counter (only if feed is scrolled down)
        const atTop = (feedRef.current?.scrollTop ?? 0) < 60;
        if (!atTop) setNewCount(n => n + incoming.length);

        // Flash new IDs for 2 s
        const ids = new Set(incoming.map(l => l.id));
        setFlashIds(ids);
        setTimeout(() => setFlashIds(new Set()), 2000);
      });

      es.addEventListener("sessions", (e: MessageEvent) => {
        const payload = JSON.parse(e.data as string) as AdminSession[];
        setSessions(payload);
      });

      es.onerror = () => {
        setStatus("error");
        es.close();
        // Reconnect after 5 s
        setTimeout(connect, 5000);
      };

      es.onopen = () => setStatus("live");
    }

    connect();
    return () => {
      esRef.current?.close();
    };
  }, []);

  // ── Globe data ──────────────────────────────────────────────────────────
  const points = sessions.map(s => ({
    lat:   s.location?.lat ?? 0,
    lng:   s.location?.lon ?? 0,
    size:  s.isFlagged ? 0.65 : 0.32,
    color: s.isFlagged ? "#ef4444" : "#22c55e",
    label: `${s.email} • ${s.location?.city ?? "Unknown"}`
  }));

  const arcs = useMemo(
    () =>
      logs
        .filter(l => l.type === "IMPOSSIBLE_TRAVEL")
        .map(l => {
          const m = l.metadata as {
            previousLocation?: { lat?: number; lon?: number };
            currentLocation?: { lat?: number; lon?: number };
          };
          return {
            startLat: m.previousLocation?.lat,
            startLng: m.previousLocation?.lon,
            endLat:   m.currentLocation?.lat,
            endLng:   m.currentLocation?.lon,
            color: ["rgba(248,113,113,0.15)", "rgba(248,113,113,0.95)"]
          };
        })
        .filter(a => a.startLat && a.startLng && a.endLat && a.endLng),
    [logs]
  );

  // ── Clear unread badge when user scrolls to top ─────────────────────────
  function handleFeedScroll() {
    if ((feedRef.current?.scrollTop ?? 0) < 60) setNewCount(0);
  }

  const flaggedCount  = sessions.filter(s => s.isFlagged).length;
  const aiCount       = logs.filter(l => l.aiAnalysis).length;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Command Center
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Real-time security intelligence
          </p>
        </div>
        <LiveBadge status={status} />
      </div>

      {/* ── Metric cards ── */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric title="Active Sessions" value={sessions.length} icon={RadioTower}  color="cyan" />
        <Metric title="Flagged Nodes"   value={flaggedCount}    icon={AlertTriangle} color="red"  />
        <Metric title="AI Reviewed"     value={aiCount}         icon={BrainCircuit} color="violet" />
      </section>

      {/* ── Globe + Feed ── */}
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Globe */}
        <article className="min-h-[560px] overflow-hidden rounded-xl border border-cyan-300/15 bg-slate-950/85 shadow-[0_0_24px_rgba(6,182,212,0.06)]">
          <div className="flex items-center justify-between border-b border-cyan-300/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-white">Global Session Intelligence</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
              {sessions.length} node{sessions.length !== 1 ? "s" : ""} tracked
            </div>
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

        {/* Security Feed */}
        <article className="flex flex-col rounded-xl border border-cyan-300/15 bg-slate-950/85 shadow-[0_0_24px_rgba(6,182,212,0.06)]">
          <div className="flex shrink-0 items-center justify-between border-b border-cyan-300/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">Security Feed</h2>
              {newCount > 0 && (
                <button
                  onClick={() => {
                    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                    setNewCount(0);
                  }}
                  className="flex animate-bounce items-center gap-1.5 rounded-full bg-cyan-500/20 px-2.5 py-1 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-400/30 transition hover:bg-cyan-500/30"
                >
                  <Zap className="h-3 w-3" />
                  {newCount} new
                </button>
              )}
            </div>
            <span className="text-xs text-slate-500">
              {logs.length} event{logs.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div
            ref={feedRef}
            onScroll={handleFeedScroll}
            className="flex-1 overflow-y-auto p-4"
            style={{ maxHeight: 560 }}
          >
            {status === "connecting" && !initialised.current ? (
              <FeedSkeleton />
            ) : (
              <div className="grid gap-2.5">
                {logs.map(log => (
                  <LogCard
                    key={log.id}
                    log={log}
                    isNew={flashIds.has(log.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LiveBadge({ status }: { status: ConnectionStatus }) {
  if (status === "live") {
    return (
      <div className="flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3.5 py-1.5 shadow-[0_0_12px_rgba(34,197,94,0.15)]">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
        </span>
        <Wifi className="h-3.5 w-3.5 text-green-400" />
        <span className="text-xs font-semibold tracking-widest text-green-300 uppercase">
          Live
        </span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3.5 py-1.5">
        <WifiOff className="h-3.5 w-3.5 text-red-400" />
        <span className="text-xs font-semibold tracking-widest text-red-300 uppercase">
          Reconnecting…
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-500/30 bg-slate-800/50 px-3.5 py-1.5">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-slate-400" />
      <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
        Connecting…
      </span>
    </div>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
  color
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: "cyan" | "red" | "violet";
}) {
  const ring  = { cyan: "ring-cyan-400/20",   red: "ring-red-400/20",   violet: "ring-violet-400/20" }[color];
  const glow  = { cyan: "text-cyan-400",       red: "text-red-400",      violet: "text-violet-400"    }[color];
  const bg    = { cyan: "bg-cyan-400/8",       red: "bg-red-400/8",      violet: "bg-violet-400/8"    }[color];

  return (
    <article className={`rounded-xl border border-white/5 ${bg} p-5 ring-1 ${ring}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{title}</p>
        <div className={`rounded-lg border border-white/5 p-1.5 ${bg}`}>
          <Icon className={`h-4 w-4 ${glow}`} />
        </div>
      </div>
      <p className={`mt-4 text-4xl font-bold tabular-nums tracking-tight ${glow}`}>{value}</p>
    </article>
  );
}

function LogCard({ log, isNew }: { log: SecurityLog; isNew: boolean }) {
  const severe = log.severity === "HIGH" || log.severity === "CRITICAL";
  const Icon   = getEventIcon(log.type);

  return (
    <section
      className={`
        relative overflow-hidden rounded-lg border p-4 transition-all duration-500
        ${severityClass(log.severity)}
        ${isNew ? "ring-2 ring-cyan-400/60 shadow-[0_0_18px_rgba(6,182,212,0.25)]" : ""}
      `}
    >
      {/* New-event shimmer */}
      {isNew && (
        <span className="absolute inset-0 animate-[shimmer_0.8s_ease-out_forwards] bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent" />
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconClass(log.severity)}`} />
          <span className="text-sm font-semibold text-white">
            {log.type.replaceAll("_", " ")}
          </span>
          {isNew && (
            <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300 ring-1 ring-cyan-400/30">
              new
            </span>
          )}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${severityBadge(log.severity)}`}>
          {log.severity}
        </span>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-300">{log.details}</p>

      {log.aiAnalysis ? (
        <div className="mt-3 rounded-md border border-cyan-300/10 bg-cyan-300/5 p-3">
          <p className="text-xs font-semibold text-cyan-200">
            Gemini confidence: {log.aiAnalysis.confidence_score}%
          </p>
          {log.aiAnalysis.recommended_action && (
            <p className="mt-1 text-xs leading-5 text-slate-300">
              {log.aiAnalysis.recommended_action}
            </p>
          )}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-slate-500">
        {log.ip} • {new Date(log.timestamp).toLocaleString()}
      </p>

      {severe && (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 opacity-75 shadow-[0_0_6px_rgba(239,68,68,0.9)]">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
        </span>
      )}
    </section>
  );
}

function FeedSkeleton() {
  return (
    <div className="grid gap-2.5 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 rounded-lg border border-cyan-300/10 bg-slate-900/60" />
      ))}
    </div>
  );
}
