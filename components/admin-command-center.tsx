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
  Bot,
  Link as LinkIcon,
  Database,
  Activity,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Coins,
  Cpu,
  Layers,
  Copy,
  Check
} from "lucide-react";

import { BlockchainExplorer } from "@/components/blockchain-explorer";

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
    who?: string;
    what?: string;
    when?: string;
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

type HoneyLogEntry = {
  id: string;
  sessionToken: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string | null;
  location: { lat?: number; lon?: number; city?: string; country?: string } | null;
  action: string;
  payload: Record<string, unknown>;
  aiConfidenceScore: number | null;
  aiSummary: string | null;
  timestamp: string;
};

type HoneySession = {
  sessionToken: string;
  email: string;
  ip: string;
  actions: number;
  firstSeen: string;
  lastSeen: string;
  confidence: number | null;
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
  const [honeyLogs, setHoneyLogs]           = useState<HoneyLogEntry[]>([]);
  const [honeySessions, setHoneySessions]   = useState<HoneySession[]>([]);
  const [loadingHoney, setLoadingHoney]     = useState(false);
  const [activeTab, setActiveTab]           = useState<"realtime" | "deception" | "blockchain">("realtime");

  // Blockchain Ledger & Forensics State
  const [blockchainInfo, setBlockchainInfo] = useState<any>(null);
  const [forensicData, setForensicData]     = useState<any>(null);
  const [loadingBlockchain, setLoadingBlockchain] = useState(false);
  const [scanningForensics, setScanningForensics] = useState(false);

  // Anchor Form State
  const [anchorUserId, setAnchorUserId]     = useState("user_999");
  const [anchorAction, setAnchorAction]     = useState("BRUTE_FORCE_ATTEMPT");
  const [anchorRisk, setAnchorRisk]         = useState("HIGH");
  const [anchoring, setAnchoring]           = useState(false);
  const [anchorReceipt, setAnchorReceipt]   = useState<any>(null);
  const [anchorError, setAnchorError]       = useState<string | null>(null);
  const [copiedText, setCopiedText]         = useState<string | null>(null);

  const fetchBlockchainInfo = async () => {
    setLoadingBlockchain(true);
    try {
      const res = await fetch("/api/admin/blockchain-info");
      const data = await res.json();
      setBlockchainInfo(data);
    } catch (err) {
      console.error("Failed to fetch blockchain info:", err);
    } finally {
      setLoadingBlockchain(false);
    }
  };

  const runForensicScan = async () => {
    setScanningForensics(true);
    try {
      const res = await fetch("/api/admin/forensic-verify");
      const data = await res.json();
      setForensicData(data);
    } catch (err) {
      console.error("Failed to run forensic scan:", err);
    } finally {
      setScanningForensics(false);
    }
  };

  useEffect(() => {
    if (activeTab === "blockchain") {
      fetchBlockchainInfo();
      runForensicScan();
    }
  }, [activeTab]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleAnchorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnchoring(true);
    setAnchorReceipt(null);
    setAnchorError(null);
    try {
      const res = await fetch("/api/admin/forensic-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: anchorUserId,
          action: anchorAction,
          riskScore: anchorRisk
        })
      });
      const data = await res.json();
      if (data.success) {
        setAnchorReceipt(data.receipt);
        // Refresh blockchain info and run forensic scan
        fetchBlockchainInfo();
        runForensicScan();
      } else {
        setAnchorError(data.error || "Failed to anchor log.");
      }
    } catch (err: any) {
      setAnchorError(err.message || "Network error while anchoring.");
    } finally {
      setAnchoring(false);
    }
  };
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

  // ── Fetch Deception Intel ───────────────────────────────────────────────
  useEffect(() => {
    async function fetchHoney() {
      setLoadingHoney(true);
      try {
        const res = await fetch("/api/security/admin/honeylogs");
        if (res.ok) {
          const data = await res.json();
          setHoneyLogs(data.logs);
          setHoneySessions(data.sessions);
        }
      } catch (err) {
        console.error("Failed to fetch deception logs");
      } finally {
        setLoadingHoney(false);
      }
    }

    if (activeTab === "deception") {
      fetchHoney();
    }
  }, [activeTab]);

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

      {/* ── Tab Navigation ── */}
      <div className="flex border-b border-cyan-300/10">
        <button
          onClick={() => setActiveTab("realtime")}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all ${
            activeTab === "realtime"
              ? "border-b-2 border-cyan-400 text-cyan-400"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <RadioTower className="h-4 w-4" />
          Real-time Intelligence
        </button>
        <button
          onClick={() => setActiveTab("deception")}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all ${
            activeTab === "deception"
              ? "border-b-2 border-cyan-400 text-cyan-400"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Fingerprint className="h-4 w-4" />
          Deception Mode Intel
        </button>
        <button
          onClick={() => setActiveTab("blockchain")}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all ${
            activeTab === "blockchain"
              ? "border-b-2 border-cyan-400 text-cyan-400"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Layers className="h-4 w-4" />
          Forensic Ledger Explorer
        </button>
      </div>

      {/* ── Main Content ── */}
      {activeTab === "realtime" && (
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
      )}

      {activeTab === "deception" && (
        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          {/* Attacker Sessions */}
          <article className="flex flex-col rounded-xl border border-cyan-300/15 bg-slate-950/85 shadow-[0_0_24px_rgba(6,182,212,0.06)]">
            <div className="flex shrink-0 items-center justify-between border-b border-cyan-300/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">Trapped Attackers</h2>
              <span className="text-xs text-slate-500">{honeySessions.length} active sessions</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 620 }}>
              {loadingHoney ? (
                <FeedSkeleton />
              ) : (
                <div className="grid gap-3">
                  {honeySessions.length === 0 ? (
                    <p className="py-12 text-center text-sm text-slate-500">No active deception sessions</p>
                  ) : (
                    honeySessions.map(session => (
                      <AttackerSessionCard key={session.sessionToken} session={session} />
                    ))
                  )}
                </div>
              )}
            </div>
          </article>

          {/* Live Honey Feed */}
          <article className="flex flex-col rounded-xl border border-cyan-300/15 bg-slate-950/85 shadow-[0_0_24px_rgba(6,182,212,0.06)]">
            <div className="flex shrink-0 items-center justify-between border-b border-cyan-300/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">Live Honey Feed</h2>
                <div className="flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400 ring-1 ring-cyan-400/30">
                  Capturing
                </div>
              </div>
              <span className="text-xs text-slate-500">{honeyLogs.length} events logged</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 620 }}>
              {loadingHoney ? (
                <FeedSkeleton />
              ) : (
                <div className="grid gap-2.5">
                  {honeyLogs.length === 0 ? (
                    <p className="py-12 text-center text-sm text-slate-500">No telemetry captured yet</p>
                  ) : (
                    honeyLogs.map(log => (
                      <HoneyLogCard key={log.id} log={log} />
                    ))
                  )}
                </div>
              )}
            </div>
          </article>
        </section>
      )}

      {activeTab === "blockchain" && (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_1.9fr]">
          <style>{`
            @keyframes scan {
              0% { top: 0%; opacity: 0; }
              50% { opacity: 1; }
              100% { top: 100%; opacity: 0; }
            }
            .scanner-line {
              animation: scan 2s linear infinite;
            }
          `}</style>

          {/* Left Column: Metrics & Form */}
          <div className="grid gap-6 align-start content-start">
            {/* Integrity Status Card */}
            <article className="relative overflow-hidden rounded-xl border border-cyan-300/15 bg-slate-950/85 p-6 shadow-[0_0_24px_rgba(6,182,212,0.06)]">
              {scanningForensics && (
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_rgba(34,211,238,0.8)] scanner-line" style={{ zIndex: 10 }} />
              )}
              <div className="flex items-center justify-between border-b border-cyan-300/10 pb-4 mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-cyan-400" />
                    Ledger Integrity Status
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Real-time forensic verification scanning</p>
                </div>
                <button
                  onClick={runForensicScan}
                  disabled={scanningForensics}
                  className="rounded-md border border-cyan-400/30 bg-cyan-400/10 p-2 text-cyan-400 hover:bg-cyan-400/20 disabled:opacity-50 transition-all"
                  title="Run forensic scan"
                >
                  <RefreshCw className={`h-4 w-4 ${scanningForensics ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="flex flex-col items-center justify-center py-4">
                {/* Glowing neon progress circle */}
                <div className="relative flex items-center justify-center h-32 w-32 mb-4">
                  <svg className="absolute transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-slate-800"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className={`${
                        (forensicData?.summary?.integrityScore ?? 100) === 100
                          ? "stroke-cyan-500"
                          : (forensicData?.summary?.integrityScore ?? 100) >= 50
                          ? "stroke-orange-500"
                          : "stroke-red-500"
                      } transition-all duration-1000`}
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray="251.2"
                      strokeDashoffset={
                        251.2 - (251.2 * (forensicData?.summary?.integrityScore ?? 100)) / 100
                      }
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="flex flex-col items-center justify-center z-10">
                    <span className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
                      {forensicData?.summary?.integrityScore ?? 100}%
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                      INTEGRITY
                    </span>
                  </div>
                </div>

                <div className="text-center">
                  {scanningForensics ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-400 ring-1 ring-cyan-500/30">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Scanning Database...
                    </span>
                  ) : (forensicData?.summary?.overallStatus === "COMPLIANT" || !forensicData) ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-400 ring-1 ring-green-500/30 shadow-[0_0_8px_rgba(34,197,94,0.15)]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      SECURE & COMPLIANT
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-400 ring-1 ring-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.25)] animate-pulse">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      TAMPERING DETECTED
                    </span>
                  )}
                </div>
              </div>

              {/* Stats detail grid */}
              <div className="grid grid-cols-3 gap-2.5 mt-6 border-t border-cyan-300/10 pt-5 text-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">On-Chain</p>
                  <p className="text-xl font-bold text-white mt-1 tabular-nums">
                    {forensicData?.summary?.totalOnChainRecords ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Database</p>
                  <p className="text-xl font-bold text-white mt-1 tabular-nums">
                    {forensicData?.summary?.totalDatabaseRecords ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Anomalies</p>
                  <p className={`text-xl font-bold mt-1 tabular-nums ${
                    (forensicData?.summary?.flagsRaised ?? 0) > 0 ? "text-red-400" : "text-slate-400"
                  }`}>
                    {forensicData?.summary?.flagsRaised ?? 0}
                  </p>
                </div>
              </div>
            </article>

            {/* Interactive Security Anchor (Emit Log) */}
            <article className="rounded-xl border border-cyan-300/15 bg-slate-950/85 p-6 shadow-[0_0_24px_rgba(6,182,212,0.06)]">
              <div className="border-b border-cyan-300/10 pb-4 mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-cyan-400" />
                  Anchor Security Alert
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Commit a mock forensic incident record to the blockchain ledger</p>
              </div>

              <form onSubmit={handleAnchorSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    User Identifier
                  </label>
                  <input
                    type="text"
                    required
                    value={anchorUserId}
                    onChange={(e) => setAnchorUserId(e.target.value)}
                    className="w-full rounded-lg border border-cyan-300/10 bg-slate-900/60 px-3.5 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none transition-colors"
                    placeholder="e.g. user_999"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Incident Action
                  </label>
                  <select
                    value={anchorAction}
                    onChange={(e) => setAnchorAction(e.target.value)}
                    className="w-full rounded-lg border border-cyan-300/10 bg-slate-900/60 px-3.5 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none transition-colors font-sans"
                  >
                    <option value="BRUTE_FORCE_ATTEMPT" className="bg-slate-900 text-white">BRUTE FORCE ATTEMPT</option>
                    <option value="SQL_INJECTION_SQLI" className="bg-slate-900 text-white">SQL INJECTION (SQLI)</option>
                    <option value="API_SECRET_LEAK" className="bg-slate-900 text-white">API SECRET LEAK</option>
                    <option value="PRIVILEGE_ESCALATION" className="bg-slate-900 text-white">PRIVILEGE ESCALATION</option>
                    <option value="EXPIRED_SESSION_REPLAY" className="bg-slate-900 text-white">EXPIRED SESSION REPLAY</option>
                    <option value="SUSPICIOUS_GEO_LOGIN" className="bg-slate-900 text-white">SUSPICIOUS GEO LOGIN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Risk Severity
                  </label>
                  <select
                    value={anchorRisk}
                    onChange={(e) => setAnchorRisk(e.target.value)}
                    className="w-full rounded-lg border border-cyan-300/10 bg-slate-900/60 px-3.5 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none transition-colors font-sans"
                  >
                    <option value="LOW" className="bg-slate-900 text-white">LOW</option>
                    <option value="MEDIUM" className="bg-slate-900 text-white">MEDIUM</option>
                    <option value="HIGH" className="bg-slate-900 text-white">HIGH</option>
                    <option value="CRITICAL" className="bg-slate-900 text-white">CRITICAL</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={anchoring}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold tracking-wider uppercase text-xs py-3 px-4 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {anchoring ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Mining Transaction...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-4 w-4" />
                      Anchor Log to Ledger
                    </>
                  )}
                </button>
              </form>

              {/* Anchor success receipt */}
              {anchorReceipt && (
                <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/5 p-4 ring-1 ring-green-500/10 animate-[fadeIn_0.3s_ease-out]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">
                      Block Sealed Successfully
                    </span>
                    <button
                      type="button"
                      onClick={() => setAnchorReceipt(null)}
                      className="text-slate-500 hover:text-slate-300 text-xs font-semibold"
                    >
                      Dismiss
                    </button>
                  </div>
                  <div className="space-y-1.5 text-[10px] font-medium text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">TX HASH:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-green-300 truncate max-w-[120px] font-mono">
                          {anchorReceipt.transactionHash}
                        </span>
                        <button
                          onClick={() => handleCopy(anchorReceipt.transactionHash)}
                          className="text-slate-500 hover:text-slate-300"
                        >
                          {copiedText === anchorReceipt.transactionHash ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">BLOCK:</span>
                      <span className="text-white">#{anchorReceipt.blockNumber}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">GAS USED:</span>
                      <span className="text-cyan-300">{anchorReceipt.gasUsed} gas</span>
                    </div>
                  </div>
                </div>
              )}

              {anchorError && (
                <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 ring-1 ring-red-500/10">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">
                    Anchoring Failed
                  </p>
                  <p className="text-xs text-red-200">{anchorError}</p>
                </div>
              )}
            </article>
          </div>

          {/* Right Column: Network info, Audit verification comparisons, Blocks Stream */}
          <div className="grid gap-6 align-start content-start">
            {/* Blockchain Network Status */}
            <article className="rounded-xl border border-cyan-300/15 bg-slate-950/85 p-6 shadow-[0_0_24px_rgba(6,182,212,0.06)]">
              <div className="border-b border-cyan-300/10 pb-4 mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-cyan-400" />
                    Ledger Node Status
                  </span>
                  {blockchainInfo?.success ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 uppercase tracking-widest">
                      <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
                      Online
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase tracking-widest">
                      <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                      Offline
                    </span>
                  )}
                </h2>
              </div>

              {loadingBlockchain && !blockchainInfo ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                </div>
              ) : blockchainInfo?.success ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 border-r border-cyan-300/5 pr-4">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500 font-semibold uppercase">RPC Network:</span>
                      <span className="text-slate-300 truncate max-w-[150px]">{blockchainInfo.network.rpcUrl}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500 font-semibold uppercase">Chain ID:</span>
                      <span className="text-slate-300">{blockchainInfo.network.chainId}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500 font-semibold uppercase">Gas Price:</span>
                      <span className="text-slate-300">{blockchainInfo.network.gasPriceGwei} Gwei</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500 font-semibold uppercase">Block Height:</span>
                      <span className="text-cyan-300 font-mono">#{blockchainInfo.network.blockNumber}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pl-2">
                    <div className="flex flex-col text-[11px]">
                      <span className="text-slate-500 font-semibold uppercase">Contract:</span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-slate-400 font-mono text-[10px] truncate max-w-[130px]">
                          {blockchainInfo.network.contractAddress}
                        </span>
                        <button
                          onClick={() => handleCopy(blockchainInfo.network.contractAddress)}
                          className="text-slate-500 hover:text-slate-300 ml-1"
                        >
                          {copiedText === blockchainInfo.network.contractAddress ? (
                            <Check className="h-3.5 w-3.5 text-green-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex flex-col text-[11px]">
                      <span className="text-slate-500 font-semibold uppercase">Operator Wallet:</span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-slate-400 font-mono text-[10px] truncate max-w-[130px]">
                          {blockchainInfo.network.operatorAddress}
                        </span>
                        <button
                          onClick={() => handleCopy(blockchainInfo.network.operatorAddress)}
                          className="text-slate-500 hover:text-slate-300 ml-1"
                        >
                          {copiedText === blockchainInfo.network.operatorAddress ? (
                            <Check className="h-3.5 w-3.5 text-green-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500 font-semibold uppercase">Operator Balance:</span>
                      <span className="text-yellow-400 font-semibold flex items-center gap-1">
                        <Coins className="h-3 w-3 text-yellow-500" />
                        {blockchainInfo.network.operatorBalanceEth} ETH
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-center text-red-200">
                  <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-400" />
                  <h3 className="text-sm font-bold text-white">Local Ledger Daemon Inactive</h3>
                  <p className="mt-1.5 text-xs text-red-300/80 leading-relaxed">
                    The local smart contract and node are not reachable. To deploy the ledger, run the following commands in your workspace:
                  </p>
                  <div className="mt-3 text-left bg-slate-950 p-2.5 rounded border border-white/5 font-mono text-[10px] text-cyan-200 select-all space-y-1 overflow-x-auto">
                    <div># 1. Start Hardhat Node:</div>
                    <div className="text-white font-bold">npx hardhat node</div>
                    <div className="mt-2"># 2. Deploy Smart Contract:</div>
                    <div className="text-white font-bold">npx hardhat run scripts/deploy.js --network localhost</div>
                  </div>
                  <button
                    onClick={() => {
                      fetchBlockchainInfo();
                      runForensicScan();
                    }}
                    className="mt-4 text-xs font-bold text-cyan-400 hover:text-cyan-300 border border-cyan-400/20 rounded px-3 py-1.5 bg-cyan-400/5 hover:bg-cyan-400/10 transition-all"
                  >
                    Retry Connection
                  </button>
                </div>
              )}
            </article>

            {/* Forensic Audit Trail comparisons */}
            <article className="rounded-xl border border-cyan-300/15 bg-slate-950/85 p-6 shadow-[0_0_24px_rgba(6,182,212,0.06)]">
              <div className="border-b border-cyan-300/10 pb-4 mb-4 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Database className="h-5 w-5 text-cyan-400" />
                    Forensic Verification Auditing
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Cross-referencing database records with the blockchain ledger</p>
                </div>
              </div>

              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                {!forensicData ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mb-3" />
                    <p className="text-sm font-medium text-slate-400">Loading audit trail...</p>
                  </div>
                ) : forensicData.auditTrail?.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">No security logs recorded on-chain yet.</p>
                ) : (
                  forensicData.auditTrail.map((record: any) => {
                    const isVerified = record.status === "VERIFIED";
                    const isDeleted = record.status === "LOG_DELETION_DETECTED";
                    const isMutated = record.status === "DATA_MUTATION_DETECTED";

                    return (
                      <div
                        key={record.index}
                        className={`rounded-lg border p-4 transition-all duration-300 ${
                          isVerified
                            ? "border-green-500/20 bg-green-500/5 hover:border-green-500/30"
                            : isDeleted
                            ? "border-red-500/25 bg-red-500/5 hover:border-red-500/35 shadow-[0_0_15px_rgba(239,68,68,0.05)]"
                            : "border-orange-500/25 bg-orange-500/5 hover:border-orange-500/35 shadow-[0_0_15px_rgba(249,115,22,0.05)]"
                        }`}
                      >
                        {/* Title bar */}
                        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white font-mono">
                              LOG INDEX #{record.index}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(record.onChain.timestamp).toLocaleString()}
                            </span>
                          </div>

                          <div>
                            {isVerified && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-300 ring-1 ring-green-500/30">
                                <Shield className="h-3 w-3" /> Verified
                              </span>
                            )}
                            {isDeleted && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300 ring-1 ring-red-500/30 animate-pulse">
                                <Trash2 className="h-3 w-3" /> DB DELETED (TAMPERED)
                              </span>
                            )}
                            {isMutated && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-300 ring-1 ring-orange-500/30">
                                <AlertTriangle className="h-3 w-3" /> DB MUTATED (TAMPERED)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Mismatch Warning Text */}
                        {!isVerified && (
                          <div className="mb-3 rounded border border-red-500/20 bg-red-500/5 p-2 text-[10.5px] leading-relaxed text-red-300 font-medium">
                            {record.discrepancyDetails}
                          </div>
                        )}

                        {/* Side by side comparison */}
                        <div className="grid gap-3 sm:grid-cols-2">
                          {/* Blockchain */}
                          <div className="bg-slate-900/60 p-2.5 rounded border border-cyan-500/10 relative">
                            <div className="absolute top-2 right-2 text-cyan-400 opacity-20">
                              <LinkIcon className="h-4 w-4" />
                            </div>
                            <h4 className="text-[10px] font-bold uppercase text-cyan-400 tracking-wider mb-2 border-b border-cyan-500/10 pb-1">
                              On-Chain Record
                            </h4>
                            <div className="space-y-1 text-[10px] font-medium text-slate-300 font-mono">
                              <div><span className="text-slate-500 font-semibold">User:</span> {record.onChain.userId}</div>
                              <div><span className="text-slate-500 font-semibold">Action:</span> {record.onChain.action}</div>
                              <div>
                                <span className="text-slate-500 font-semibold">Risk:</span>{" "}
                                <span className={`${
                                  record.onChain.riskScore === "CRITICAL"
                                    ? "text-red-400"
                                    : record.onChain.riskScore === "HIGH"
                                    ? "text-orange-400"
                                    : "text-cyan-400"
                                }`}>
                                  {record.onChain.riskScore}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Database */}
                          <div className={`p-2.5 rounded border relative ${
                            isVerified
                              ? "bg-slate-900/60 border-white/5"
                              : isDeleted
                              ? "bg-red-950/20 border-red-500/20"
                              : "bg-orange-950/20 border-orange-500/20"
                          }`}>
                            <div className="absolute top-2 right-2 text-slate-500 opacity-20">
                              <Database className="h-4 w-4" />
                            </div>
                            <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-2 border-b pb-1 ${
                              isVerified ? "text-slate-400 border-white/5" : "text-red-400 border-red-500/10"
                            }`}>
                              Database Record
                            </h4>

                            {record.database ? (
                              <div className="space-y-1 text-[10px] font-medium font-mono">
                                <div className={record.database.userId !== record.onChain.userId ? "text-orange-300 font-bold bg-orange-500/10 px-1 rounded" : "text-slate-300"}>
                                  <span className="text-slate-500 font-semibold">User:</span> {record.database.userId}
                                </div>
                                <div className={record.database.action !== record.onChain.action ? "text-orange-300 font-bold bg-orange-500/10 px-1 rounded" : "text-slate-300"}>
                                  <span className="text-slate-500 font-semibold">Action:</span> {record.database.action}
                                </div>
                                <div className={record.database.riskScore !== record.onChain.riskScore ? "text-orange-300 font-bold bg-orange-500/10 px-1 rounded" : "text-slate-300"}>
                                  <span className="text-slate-500 font-semibold">Risk:</span>{" "}
                                  <span className={`${
                                    record.database.riskScore === "CRITICAL"
                                      ? "text-red-400"
                                      : record.database.riskScore === "HIGH"
                                      ? "text-orange-400"
                                      : "text-slate-400"
                                  }`}>
                                    {record.database.riskScore}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-2 h-14">
                                <span className="text-xs font-bold text-red-400 uppercase tracking-widest animate-pulse">
                                  MISSING / DELETED
                                </span>
                                <span className="text-[9px] text-slate-500 mt-1">Record completely purged</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </article>

            {/* On-chain block explorer (Blocks / Logs / Network) */}
            <BlockchainExplorer />
          </div>
        </div>
      )}

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
        <div className="mt-3 rounded-lg border border-cyan-300/10 bg-cyan-300/5 p-3.5">
          <div className="mb-2.5 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
              AI Insight
            </p>
            {typeof log.aiAnalysis.confidence_score === "number" && (
              <span className="ml-auto rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-400/20">
                {log.aiAnalysis.confidence_score}% confidence
              </span>
            )}
          </div>

          <dl className="space-y-2">
            <InsightRow label="Who" value={log.aiAnalysis.who} />
            <InsightRow label="What" value={log.aiAnalysis.what} />
            <InsightRow label="When" value={log.aiAnalysis.when} />
            {!log.aiAnalysis.who && !log.aiAnalysis.what && log.aiAnalysis.incident_summary && (
              <p className="text-xs leading-5 text-slate-300">
                {log.aiAnalysis.incident_summary}
              </p>
            )}
          </dl>

          {log.aiAnalysis.recommended_action && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-cyan-400/10 px-2.5 py-2 ring-1 ring-inset ring-cyan-400/15">
              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/70">
                  Recommended action
                </p>
                <p className="text-xs font-medium text-cyan-100">
                  {log.aiAnalysis.recommended_action}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : analyzing ? (
        <div className="mt-3 flex items-center gap-3 rounded-md border border-cyan-300/5 bg-slate-900/50 p-4">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
          <p className="text-xs animate-pulse font-medium text-slate-500">
            AI is analyzing behavioral patterns...
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

// One labeled line in the AI insight (Who / What / When). Hidden when empty.
function InsightRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[2.75rem_1fr] gap-2.5">
      <dt className="pt-px text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="text-xs leading-5 text-slate-300">{value}</dd>
    </div>
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

// ─── Deception Intel Sub-components ──────────────────────────────────────────

function AttackerSessionCard({ session }: { session: HoneySession }) {
  const [blocking, setBlocking] = useState(false);

  async function handlePromote() {
    if (!confirm(`Promote interception to full block for ${session.email}?`)) return;
    setBlocking(true);
    try {
      const res = await fetch("/api/security/admin/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session.email })
      });
      if (res.ok) alert("User blocked successfully");
    } catch {
      alert("Failed to block user");
    } finally {
      setBlocking(false);
    }
  }

  return (
    <article className="rounded-lg border border-cyan-300/10 bg-slate-900/60 p-4 ring-1 ring-cyan-300/5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{session.email}</p>
          <p className="text-[11px] text-slate-500">{session.ip} • {session.actions} interactions</p>
        </div>
        <button
          onClick={handlePromote}
          disabled={blocking}
          className="shrink-0 rounded-md bg-red-500/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400 ring-1 ring-red-500/20 transition hover:bg-red-500/20 disabled:opacity-50"
        >
          {blocking ? "..." : "Block"}
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] uppercase font-bold tracking-widest">
        <span className="text-slate-500">AI Confidence:</span>
        <span className={session.confidence && session.confidence >= 80 ? "text-red-400" : "text-cyan-400"}>
          {session.confidence ?? "??"}%
        </span>
      </div>
      <div className="mt-1 h-1 w-full rounded-full bg-slate-800">
        <div 
          className="h-full rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]" 
          style={{ width: `${Math.min(100, (session.actions / 20) * 100)}%` }}
        />
      </div>
    </article>
  );
}

function HoneyLogCard({ log }: { log: HoneyLogEntry }) {
  return (
    <article className="rounded-lg border border-cyan-300/5 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-3 w-3 text-cyan-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-white">
            {log.action.replaceAll("_", " ")}
          </span>
        </div>
        <span className="text-[10px] text-slate-500">
          {new Date(log.timestamp).toLocaleTimeString()}
        </span>
      </div>
      
      {Object.keys(log.payload).length > 0 && (
        <div className="mt-2 rounded bg-slate-950/50 p-2 border border-white/5">
          <pre className="text-[10px] text-cyan-200/70 overflow-x-auto">
            {JSON.stringify(log.payload, null, 2)}
          </pre>
        </div>
      )}
      
      <p className="mt-2 text-[10px] text-slate-500 font-medium">
        {log.userEmail} • {log.ipAddress}
      </p>
    </article>
  );
}
