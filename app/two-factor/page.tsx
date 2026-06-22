import { TwoFactorChallenge } from "@/components/two-factor-challenge";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default async function TwoFactorPage() {
  // Check for the challenge cookie better-auth uses. If it's missing,
  // the user likely stumbled here directly without a pending login.
  const cookieStore = await cookies();
  const hasChallenge = 
    cookieStore.has("two_factor") || 
    cookieStore.has("better-auth.two_factor_challenge");

  if (!hasChallenge) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-[90vh] max-w-md flex-col justify-center px-5 py-10">
      <div className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950/60 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl" />
        
        <div className="relative">
          <h1 className="text-2xl font-bold tracking-tight text-white">Security Verification</h1>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            Your account is protected by Two-Factor Authentication. Please enter your verification code.
          </p>
          
          <div className="mt-8">
            <TwoFactorChallenge />
          </div>
        </div>
      </div>
    </main>
  );
}
