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
  Zap,
  Filter,
  Clock,
  Shield,
  LayoutGrid,
  Ban,
  Loader2,
  Sparkles,
  Bot
} from "lucide-react";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

// ─── Types ───────────────────────────────────────────────────────────────────

type AdminSession = {
  id: string;
  email: string;
  isFlagged: boolean;
  isBlocked: boolean;
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

type BlockedUser = {
  id: string;
  email: string;
  riskScore: number;
  updatedAt: string;
};

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
    case "CAPTCHA_FAILED":   return Bot;
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
  const [blockedUsers, setBlockedUsers]     = useState<BlockedUser[]>([]);
  const [typeFilter, setTypeFilter]         = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [timeFilter, setTimeFilter]         = useState("ALL"); // ALL, HOUR, DAY
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
          blocked: BlockedUser[];
        };
        setSessions(payload.sessions);
        setLogs(payload.logs);
        setBlockedUsers(payload.blocked || []);
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

      es.addEventListener("blocked", (e: MessageEvent) => {
        const payload = JSON.parse(e.data as string) as BlockedUser[];
        setBlockedUsers(payload);
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
  const points = sessions
    .filter(s => !s.isBlocked) // User request: remove blocked emails from globe
    .map(s => ({
      lat:   s.location?.lat ?? 0,
      lng:   s.location?.lon ?? 0,
      size:  s.isFlagged ? 0.8 + (s.riskScore / 200) : 0.32,
      color: s.isFlagged ? "#ef4444" : "#22c55e",
      label: `${s.isFlagged ? "[RISKY] " : ""}${s.email} • ${s.location?.city ?? "Unknown"}`
    }));

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (typeFilter !== "ALL" && log.type !== typeFilter) return false;
      if (severityFilter !== "ALL" && log.severity !== severityFilter) return false;
      
      if (timeFilter !== "ALL") {
        const logDate = new Date(log.timestamp).getTime();
        const now = Date.now();
        if (timeFilter === "HOUR" && now - logDate > 3600000) return false;
        if (timeFilter === "DAY" && now - logDate > 86400000) return false;
      }
      
      return true;
    });
  }, [logs, typeFilter, severityFilter, timeFilter]);

  const arcs = useMemo(
    () =>
      filteredLogs
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
    [filteredLogs]
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
              {filteredLogs.length} match{filteredLogs.length !== 1 ? "es" : ""}
            </span>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-cyan-300/10 bg-cyan-300/5 px-4 py-3">
            <FilterControl
              icon={LayoutGrid}
              label="Type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { label: "All Types", value: "ALL" },
                { label: "Login Success", value: "LOGIN_SUCCESS" },
                { label: "Login Failure", value: "LOGIN_FAILURE" },
                { label: "Honeypot", value: "HONEYPOT" },
                { label: "Bot Velocity", value: "BOT_VELOCITY" },
                { label: "Impossible Travel", value: "IMPOSSIBLE_TRAVEL" },
              ]}
            />
            <FilterControl
              icon={Shield}
              label="Level"
              value={severityFilter}
              onChange={setSeverityFilter}
              options={[
                { label: "All Levels", value: "ALL" },
                { label: "Critical", value: "CRITICAL" },
                { label: "High", value: "HIGH" },
                { label: "Medium", value: "MEDIUM" },
                { label: "Low", value: "LOW" },
              ]}
            />
            <FilterControl
              icon={Clock}
              label="Time"
              value={timeFilter}
              onChange={setTimeFilter}
              options={[
                { label: "All Time", value: "ALL" },
                { label: "Last Hour", value: "HOUR" },
                { label: "Last 24h", value: "DAY" },
              ]}
            />
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
                {filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Filter className="mb-3 h-10 w-10 text-slate-600" />
                    <p className="text-sm font-medium text-slate-400">No events match your filters</p>
                    <button 
                      onClick={() => { setTypeFilter("ALL"); setSeverityFilter("ALL"); setTimeFilter("ALL"); }}
                      className="mt-4 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                    >
                      Clear all filters
                    </button>
                  </div>
                ) : (
                  filteredLogs.map(log => (
                    <LogCard
                      key={log.id}
                      log={log}
                      isNew={flashIds.has(log.id)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </article>
      </section>

      {/* ── Blocked Accounts ── */}
      <section>
        <article className="rounded-xl border border-red-500/15 bg-slate-950/85 p-6 shadow-[0_0_24px_rgba(239,68,68,0.06)]">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-500/10 p-2">
                <Ban className="h-5 w-5 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Blocked Access Control</h2>
            </div>
            <span className="text-sm font-medium text-slate-500">
              {blockedUsers.length} account{blockedUsers.length !== 1 ? "s" : ""} blacklisted
            </span>
          </div>

          {blockedUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/5 py-12">
              <Shield className="mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">No active blocks enforced</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {blockedUsers.map(user => (
                <BlockedUserCard key={user.id} user={user} />
              ))}
            </div>
          )}
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

function LogCard({ log: initialLog, isNew }: { log: SecurityLog; isNew: boolean }) {
  const [log, setLog] = useState(initialLog);
  const [blocking, setBlocking] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const severe = log.severity === "HIGH" || log.severity === "CRITICAL";
  const Icon   = getEventIcon(log.type);
  const email  = (log.metadata as { email?: string })?.email;

  // Auto-analyze if missing and risk is MEDIUM or higher
  useEffect(() => {
    const autoSeverity = ["MEDIUM", "HIGH", "CRITICAL"];
    if (!log.aiAnalysis && !analyzing && autoSeverity.includes(log.severity)) {
      handleAnalyze();
    }
  }, [log.aiAnalysis, log.severity]);

  async function handleAnalyze() {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/security/admin/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: log.id })
      });
      const data = await res.json();
      if (data.ok) {
        setLog(prev => ({ ...prev, aiAnalysis: data.aiAnalysis }));
      }
    } catch (err) {
      console.error("Analysis trigger failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleBlock() {
    if (!email || !confirm(`Are you sure you want to PERMANENTLY block ${email}? This will revoke all their active sessions.`)) return;
    
    setBlocking(true);
    try {
      const res = await fetch("/api/security/admin/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        alert(`Successfully blocked ${email}`);
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || "Failed to block user"}`);
      }
    } catch (err) {
      alert("Failed to communicate with the security server.");
    } finally {
      setBlocking(false);
    }
  }

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
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${severityBadge(log.severity)}`}>
            {log.severity}
          </span>
          {email && (
            <button
              onClick={handleBlock}
              disabled={blocking}
              title={`Block ${email}`}
              className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-400 ring-1 ring-red-500/30 transition hover:bg-red-500/20 disabled:opacity-50"
            >
              {blocking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
              Block
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-300">{log.details}</p>

      {log.aiAnalysis ? (
        <div className="mt-3 rounded-md border border-cyan-300/10 bg-cyan-300/5 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="h-3 w-3 text-cyan-400" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
              Gemini Insight • {log.aiAnalysis.confidence_score}% Confidence
            </p>
          </div>
          <p className="text-xs leading-5 text-slate-300">
            {log.aiAnalysis.incident_summary}
          </p>
          {log.aiAnalysis.recommended_action && (
            <div className="mt-2 border-t border-cyan-300/5 pt-2">
              <p className="text-[10px] font-medium text-cyan-300/70">RECOMMENDED ACTION:</p>
              <p className="text-[10px] font-semibold text-cyan-200">
                {log.aiAnalysis.recommended_action}
              </p>
            </div>
          )}
        </div>
      ) : analyzing ? (
        <div className="mt-3 flex items-center gap-3 rounded-md border border-cyan-300/5 bg-slate-900/50 p-4">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
          <p className="text-xs animate-pulse font-medium text-slate-500">
            Gemini is analyzing behavioral patterns...
          </p>
        </div>
      ) : log.severity === "LOW" && !log.aiAnalysis ? (
        <button 
          onClick={handleAnalyze}
          className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-white/10 bg-white/5 px-3 py-2 text-[10px] font-semibold text-slate-400 transition hover:bg-white/10"
        >
          <Sparkles className="h-3 w-3" />
          Generate AI Summary
        </button>
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

function FilterControl({
  icon: Icon,
  label,
  value,
  onChange,
  options
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-cyan-300/10 bg-slate-900/40 px-2 py-1.5 transition-colors hover:border-cyan-300/20">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-[11px] font-medium text-slate-300 focus:outline-none appearance-none cursor-pointer pr-1"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-300">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function BlockedUserCard({ user }: { user: BlockedUser }) {
  const [unblocking, setUnblocking] = useState(false);

  async function handleUnblock() {
    if (!confirm(`Unblock ${user.email}?`)) return;
    setUnblocking(true);
    try {
      const res = await fetch("/api/security/admin/unblock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email })
      });
      if (!res.ok) throw new Error();
    } catch {
      alert("Failed to unblock user");
    } finally {
      setUnblocking(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-red-500/10 bg-red-500/5 p-4 ring-1 ring-red-500/20">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{user.email}</p>
        <p className="mt-1 text-[10px] text-slate-500">
          Risk: {user.riskScore} • Blocked {new Date(user.updatedAt).toLocaleDateString()}
        </p>
      </div>
      <button
        onClick={handleUnblock}
        disabled={unblocking}
        className="ml-4 shrink-0 rounded-md bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
      >
        {unblocking ? "..." : "Unblock"}
      </button>
    </div>
  );
}
