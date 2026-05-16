"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Mail, KeyRound, Loader2, ShieldCheck, ArrowRight } from "lucide-react";

function VerifyRequestContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email");

  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [loadingType, setLoadingType] = useState<"magic" | "otp" | null>(null);
  const [error, setError] = useState("");

  if (!email) {
    return (
      <div className="text-center text-slate-300">
        <p>No email provided. Please register first.</p>
        <button
          onClick={() => router.push("/register")}
          className="mt-4 rounded-md bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 ring-1 ring-inset ring-cyan-500/40 hover:bg-cyan-500/30"
        >
          Go to Register
        </button>
      </div>
    );
  }

  async function handleMagicLink() {
    setError("");
    setLoadingType("magic");
    try {
      const { error: magicError } = await authClient.signIn.magicLink({
        email: email as string,
        callbackURL: "/profile"
      });
      if (magicError) throw magicError;
      setMagicLinkSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send magic link");
    } finally {
      setLoadingType(null);
    }
  }

  async function handleOTP() {
    setError("");
    setLoadingType("otp");
    try {
      const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({
        email: email as string,
        type: "email-verification"
      });
      if (otpError) throw otpError;
      router.push(`/verify-otp?email=${encodeURIComponent(email as string)}`);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
      setLoadingType(null);
    }
  }

  if (magicLinkSent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400">
          <Mail className="h-8 w-8" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-white">Check Your Inbox</h2>
        <p className="mb-6 text-sm text-slate-400">
          We've sent a secure magic link to <span className="font-semibold text-white">{email}</span>.
          Click the link in the email to instantly access your dashboard.
        </p>
        <p className="text-xs text-slate-500">
          You can close this tab safely.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 ring-1 ring-slate-800">
        <ShieldCheck className="h-8 w-8 text-cyan-400" />
      </div>
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-white">Account Security</h1>
      <p className="mb-8 text-sm text-slate-400">
        To protect your data, please choose how you want to verify your email address (<span className="text-white">{email}</span>).
      </p>

      {error && (
        <div className="mb-6 rounded-md bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        <button
          onClick={handleMagicLink}
          disabled={loadingType !== null}
          className="group relative flex w-full items-center justify-between rounded-xl border border-cyan-500/20 bg-slate-950 px-6 py-5 text-left transition-all hover:bg-slate-900 disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 group-hover:scale-110 transition-all">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Magic Link</h3>
              <p className="text-xs text-slate-400">Receive a secure 1-click sign-in link</p>
            </div>
          </div>
          {loadingType === "magic" ? (
            <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          ) : (
            <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
          )}
        </button>

        <button
          onClick={handleOTP}
          disabled={loadingType !== null}
          className="group relative flex w-full items-center justify-between rounded-xl border border-purple-500/20 bg-slate-950 px-6 py-5 text-left transition-all hover:bg-slate-900 disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 group-hover:scale-110 transition-all">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">One-Time Passcode</h3>
              <p className="text-xs text-slate-400">Enter a 6-digit code sent to your email</p>
            </div>
          </div>
          {loadingType === "otp" ? (
            <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
          ) : (
            <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-purple-400 transition-colors" />
          )}
        </button>
      </div>
    </div>
  );
}

export default function VerifyRequestPage() {
  return (
    <main className="flex min-h-[calc(100vh-65px)] items-center justify-center bg-slate-950 px-5 py-16">
      <Suspense fallback={<div className="text-slate-400"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-sm">
          <VerifyRequestContent />
        </div>
      </Suspense>
    </main>
  );
}
