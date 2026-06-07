"use client";

import { useEffect, useState } from "react";
import {
  User,
  BookOpen,
  CalendarDays,
  Award,
  Eye,
  KeyRound,
  Send,
  CheckCircle2,
  Loader2,
  Activity,
  BarChart3,
  Users,
  GraduationCap
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FakeProfile = {
  name: string;
  email: string;
  joinedDate: string;
  enrolledCourses: string[];
  upcomingEvents: string[];
  recentActivity: { action: string; time: string }[];
  stats: {
    coursesEnrolled: number;
    eventsAttended: number;
    quizzesPassed: number;
    profileViews: number;
  };
};

type FakeStats = {
  totalUsers: number;
  activeToday: number;
  coursesLive: number;
  upcomingEvents: number;
};

type FakeActivityItem = {
  user: string;
  event: string;
  time: string;
};

type HoneyData = {
  profile: FakeProfile;
  stats: FakeStats;
  activityFeed: FakeActivityItem[];
  email: string;
};

// ─── Page Component ──────────────────────────────────────────────────────────

export default function HoneypotPage() {
  const [data, setData] = useState<HoneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postSaving, setPostSaving] = useState(false);
  const [postSaved, setPostSaved] = useState(false);

  // Fetch fake data on mount and log PAGE_VIEW
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/honey/status");
        if (res.ok) {
          const json = await res.json();
          setData(json as HoneyData);
        }
      } catch { /* silently degrade */ }
      setLoading(false);

      // Log that the attacker viewed the profile
      fetch("/api/honey/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VIEW_PROFILE", payload: {} })
      }).catch(() => {});
    })();
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSaving(true);
    await fetch("/api/honey/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CHANGE_PASSWORD_ATTEMPT",
        payload: {
          currentPassword: passwordForm.current,
          newPassword: passwordForm.new
        }
      })
    }).catch(() => {});
    setPasswordSaving(false);
    setPasswordSaved(true);
    setPasswordForm({ current: "", new: "", confirm: "" });
    setTimeout(() => setPasswordSaved(false), 3000);
  }

  async function handlePostSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!postContent.trim()) return;
    setPostSaving(true);
    await fetch("/api/honey/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "POST_CONTENT",
        payload: { content: postContent }
      })
    }).catch(() => {});
    setPostSaving(false);
    setPostSaved(true);
    setPostContent("");
    setTimeout(() => setPostSaved(false), 3000);
  }

  // ── Loading State ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="mx-auto flex max-w-7xl items-center justify-center px-5 py-24">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </main>
    );
  }

  const profile = data?.profile;
  const stats = data?.stats;
  const feed = data?.activityFeed ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <div className="grid gap-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome back, {profile?.name ?? "User"} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Here&apos;s your platform overview.
          </p>
        </div>

        {/* Platform Stats */}
        <section className="grid gap-4 sm:grid-cols-4">
          <StatCard icon={Users} label="Total Users" value={stats?.totalUsers ?? 0} color="cyan" />
          <StatCard icon={Activity} label="Active Today" value={stats?.activeToday ?? 0} color="green" />
          <StatCard icon={GraduationCap} label="Live Courses" value={stats?.coursesLive ?? 0} color="violet" />
          <StatCard icon={CalendarDays} label="Upcoming Events" value={stats?.upcomingEvents ?? 0} color="amber" />
        </section>

        {/* Main Grid */}
        <section className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          {/* Left: Profile + Password */}
          <div className="grid gap-6">
            {/* Profile Card */}
            <article className="rounded-xl border border-cyan-300/15 bg-slate-950/85 p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 text-xl font-bold text-white">
                  {profile?.name?.charAt(0) ?? "U"}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{profile?.name}</h2>
                  <p className="text-sm text-slate-400">{data?.email ?? profile?.email}</p>
                  <p className="text-xs text-slate-500">Joined {profile?.joinedDate}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MiniStat icon={BookOpen} label="Courses" value={profile?.stats?.coursesEnrolled ?? 0} />
                <MiniStat icon={CalendarDays} label="Events" value={profile?.stats?.eventsAttended ?? 0} />
                <MiniStat icon={Award} label="Quizzes" value={profile?.stats?.quizzesPassed ?? 0} />
                <MiniStat icon={Eye} label="Views" value={profile?.stats?.profileViews ?? 0} />
              </div>
            </article>

            {/* Password Change */}
            <article className="rounded-xl border border-cyan-300/15 bg-slate-950/85 p-6">
              <div className="flex items-center gap-2 mb-4">
                <KeyRound className="h-5 w-5 text-cyan-400" />
                <h2 className="text-lg font-bold text-white">Change Password</h2>
              </div>
              <form onSubmit={handlePasswordChange} className="grid gap-4">
                <input
                  type="password"
                  placeholder="Current password"
                  value={passwordForm.current}
                  onChange={e => setPasswordForm(p => ({ ...p, current: e.target.value }))}
                  className="w-full rounded-lg border border-cyan-300/10 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400/40"
                  required
                />
                <input
                  type="password"
                  placeholder="New password"
                  value={passwordForm.new}
                  onChange={e => setPasswordForm(p => ({ ...p, new: e.target.value }))}
                  className="w-full rounded-lg border border-cyan-300/10 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400/40"
                  required
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
                  className="w-full rounded-lg border border-cyan-300/10 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400/40"
                  required
                />
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="flex items-center justify-center gap-2 rounded-lg bg-cyan-500/20 px-4 py-2.5 text-sm font-semibold text-cyan-300 ring-1 ring-cyan-500/30 transition hover:bg-cyan-500/30 disabled:opacity-50"
                >
                  {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  {passwordSaving ? "Saving..." : "Update Password"}
                </button>
                {passwordSaved && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-400 ring-1 ring-green-500/20">
                    <CheckCircle2 className="h-4 w-4" /> Password updated successfully!
                  </div>
                )}
              </form>
            </article>

            {/* Post Content */}
            <article className="rounded-xl border border-cyan-300/15 bg-slate-950/85 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Send className="h-5 w-5 text-violet-400" />
                <h2 className="text-lg font-bold text-white">Post to Forum</h2>
              </div>
              <form onSubmit={handlePostSubmit} className="grid gap-4">
                <textarea
                  placeholder="Share something with your classmates..."
                  value={postContent}
                  onChange={e => setPostContent(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-cyan-300/10 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-400/40"
                  required
                />
                <button
                  type="submit"
                  disabled={postSaving}
                  className="flex items-center justify-center gap-2 rounded-lg bg-violet-500/20 px-4 py-2.5 text-sm font-semibold text-violet-300 ring-1 ring-violet-500/30 transition hover:bg-violet-500/30 disabled:opacity-50"
                >
                  {postSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {postSaving ? "Posting..." : "Publish Post"}
                </button>
                {postSaved && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-400 ring-1 ring-green-500/20">
                    <CheckCircle2 className="h-4 w-4" /> Post published successfully!
                  </div>
                )}
              </form>
            </article>
          </div>

          {/* Right: Activity Feed + Courses + Events */}
          <div className="grid gap-6">
            {/* Live Activity */}
            <article className="rounded-xl border border-cyan-300/15 bg-slate-950/85 p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-green-400" />
                <h2 className="text-lg font-bold text-white">Live Activity</h2>
              </div>
              <div className="grid gap-3">
                {feed.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border border-cyan-300/5 bg-slate-900/40 p-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-xs font-bold text-cyan-400">
                      {item.user.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white">
                        <span className="font-semibold">{item.user}</span>
                      </p>
                      <p className="text-xs text-slate-400">{item.event}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            {/* Enrolled Courses */}
            <article className="rounded-xl border border-cyan-300/15 bg-slate-950/85 p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-5 w-5 text-cyan-400" />
                <h2 className="text-lg font-bold text-white">My Courses</h2>
              </div>
              <div className="grid gap-2">
                {(profile?.enrolledCourses ?? []).map((course, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-cyan-300/5 bg-slate-900/40 px-4 py-3">
                    <span className="text-sm text-slate-300">{course}</span>
                    <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-400 ring-1 ring-green-500/20">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </article>

            {/* Upcoming Events */}
            <article className="rounded-xl border border-cyan-300/15 bg-slate-950/85 p-6">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Upcoming Events</h2>
              </div>
              <div className="grid gap-2">
                {(profile?.upcomingEvents ?? []).map((event, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-amber-400/10 bg-amber-500/5 px-4 py-3">
                    <span className="text-sm text-slate-300">{event}</span>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 ring-1 ring-amber-500/20">
                      Registered
                    </span>
                  </div>
                ))}
              </div>
            </article>

            {/* Recent Activity */}
            <article className="rounded-xl border border-cyan-300/15 bg-slate-950/85 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-violet-400" />
                <h2 className="text-lg font-bold text-white">Recent Activity</h2>
              </div>
              <div className="grid gap-2">
                {(profile?.recentActivity ?? []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-cyan-300/5 bg-slate-900/40 px-4 py-3">
                    <span className="text-sm text-slate-300">{item.action}</span>
                    <span className="text-xs text-slate-500">{item.time}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: "cyan" | "green" | "violet" | "amber";
}) {
  const colors = {
    cyan:   { ring: "ring-cyan-400/20",   text: "text-cyan-400",   bg: "bg-cyan-400/8" },
    green:  { ring: "ring-green-400/20",  text: "text-green-400",  bg: "bg-green-400/8" },
    violet: { ring: "ring-violet-400/20", text: "text-violet-400", bg: "bg-violet-400/8" },
    amber:  { ring: "ring-amber-400/20",  text: "text-amber-400",  bg: "bg-amber-400/8" }
  }[color];

  return (
    <article className={`rounded-xl border border-white/5 ${colors.bg} p-5 ring-1 ${colors.ring}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <div className={`rounded-lg border border-white/5 p-1.5 ${colors.bg}`}>
          <Icon className={`h-4 w-4 ${colors.text}`} />
        </div>
      </div>
      <p className={`mt-4 text-3xl font-bold tabular-nums tracking-tight ${colors.text}`}>{value.toLocaleString()}</p>
    </article>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-cyan-300/5 bg-slate-900/40 p-3 text-center">
      <Icon className="h-4 w-4 text-cyan-400 mb-1" />
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}
