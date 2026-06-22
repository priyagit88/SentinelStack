import { RegisterForm } from "@/components/register-form";

export default function RegisterPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-65px)] max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[0.9fr_1.1fr]">
      <section>
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-cyan-300">
          Bot-Aware Registration
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-white md:text-5xl">
          Create a monitored identity.
        </h1>
        <p className="mt-5 max-w-xl leading-7 text-slate-300">
          New accounts are protected by honeypot interception, millisecond velocity checks, World ID
          proof-of-personhood verification, and risk-scored session telemetry from the first request.
        </p>
      </section>
      <section className="rounded-lg border border-cyan-300/15 bg-slate-950/80 p-6 shadow-glow">
        <RegisterForm />
      </section>
    </main>
  );
}
