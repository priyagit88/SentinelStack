import { LoginForm } from "@/components/login-form";
import { RecaptchaScript } from "@/components/recaptcha-script";

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-65px)] max-w-md items-center px-5 py-12">
      <RecaptchaScript />
      <section className="rounded-lg border border-cyan-300/15 bg-slate-950/80 p-6 shadow-glow">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-cyan-300">
          Monitored Access
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Sign in</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Every login is enriched with IP, device, and location intelligence.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
