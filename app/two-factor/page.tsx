import { TwoFactorChallenge } from "@/components/two-factor-challenge";

export const runtime = "nodejs";

export default function TwoFactorPage() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-5 py-10">
      <div className="rounded-2xl border border-cyan-300/10 bg-slate-950/40 p-6">
        <h1 className="text-xl font-semibold text-white">Two-Factor Verification</h1>
        <p className="mt-1 text-sm text-slate-400">
          Enter the 6-digit code from your authenticator app to continue.
        </p>
        <div className="mt-5">
          <TwoFactorChallenge />
        </div>
      </div>
    </main>
  );
}
