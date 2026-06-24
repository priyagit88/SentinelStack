import Link from "next/link";
import { Activity, Globe2, ShieldAlert } from "lucide-react";

export default function HomePage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-65px)] max-w-7xl content-center gap-10 px-5 py-14 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex flex-col justify-center">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.28em] text-cyan-300">
          Visual Threat Intelligence
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold leading-tight text-white md:text-7xl">
          SentinelStack
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Secure auth, real-time session intelligence, impossible-travel detection, and AI SOC
          analysis in one operational command surface.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-glow"
          >
            Create Account
          </Link>
          <Link
            href="/admin"
            className="rounded-md border border-cyan-200/30 px-5 py-3 text-sm font-semibold text-cyan-100"
          >
            Open Command Center
          </Link>
        </div>
      </section>

      <section className="grid content-center gap-4">
        {[
          {
            icon: ShieldAlert,
            title: "Impossible Travel",
            text: "Haversine geometry scores anomalous logins above commercial jet velocity."
          },
          {
            icon: Activity,
            title: "Live Session Control",
            text: "Users can see every valid token and revoke suspicious concurrent devices."
          },
          {
            icon: Globe2,
            title: "3D Attack Surface",
            text: "Active sessions and critical routes are plotted as live geospatial intelligence."
          }
        ].map((item) => (
          <article
            key={item.title}
            className="rounded-lg border border-cyan-300/15 bg-slate-950/70 p-5 shadow-glow"
          >
            <item.icon className="mb-4 h-6 w-6 text-cyan-300" />
            <h2 className="text-lg font-semibold text-white">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{item.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
