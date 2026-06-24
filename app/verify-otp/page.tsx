"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react";

function VerifyOtpContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email");

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleInput = (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (!pastedData) return;
    
    const newCode = [...code];
    for (let i = 0; i < pastedData.length; i++) {
      newCode[i] = pastedData[i];
    }
    setCode(newCode);
    
    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs[focusIndex].current?.focus();
  };

  const submitOtp = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Must use verifyEmail (POST /email-otp/verify-email): it consumes the OTP
      // AND sets user.emailVerified = true. checkVerificationOtp only validates
      // the code without marking the email verified — using it left accounts
      // stuck on "email not verified" at login despite a correct OTP.
      const client = authClient as any;
      let res;
      if (client.emailOtp?.verifyEmail) {
        res = await client.emailOtp.verifyEmail({ email: email as string, otp: fullCode });
      } else if (client.emailOTP?.verifyEmail) {
        res = await client.emailOTP.verifyEmail({ email: email as string, otp: fullCode });
      } else {
        throw new Error("OTP verification method not found");
      }

      if (res?.error) throw res.error;

      setSuccess(true);
      setTimeout(() => {
        router.push("/profile");
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Invalid or expired passcode.");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (email && code.join("").length === 6) {
      void submitOtp();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!email) {
    return (
      <div className="text-center text-slate-300">
        <p>No email provided.</p>
        <button onClick={() => router.push("/register")} className="mt-4 rounded bg-slate-800 px-4 py-2">Go back</button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-white">Verification Complete</h2>
        <p className="text-sm text-slate-400">Redirecting to your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 ring-1 ring-slate-800">
        <KeyRound className="h-8 w-8 text-purple-400" />
      </div>
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-white">Enter Passcode</h1>
      <p className="mb-8 text-sm text-slate-400">
        We&apos;ve sent a 6-digit code to <span className="font-semibold text-white">{email}</span>.
      </p>

      {error && (
        <div className="mb-6 rounded-md bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20">
          {error}
        </div>
      )}

      <div className="mb-8 flex justify-between gap-2" onPaste={handlePaste}>
        {code.map((digit, index) => (
          <input
            key={index}
            ref={inputRefs[index]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleInput(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="h-12 w-12 rounded-lg border border-slate-700 bg-slate-900 text-center text-xl font-bold text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
            disabled={loading}
          />
        ))}
      </div>

      <button
        onClick={submitOtp}
        disabled={loading || code.join("").length !== 6}
        className="btn-slide w-full"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify Code"}
      </button>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <main className="flex min-h-[calc(100vh-65px)] items-center justify-center bg-slate-950 px-5 py-16">
      <Suspense fallback={<div className="text-slate-400"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-sm">
          <VerifyOtpContent />
        </div>
      </Suspense>
    </main>
  );
}
