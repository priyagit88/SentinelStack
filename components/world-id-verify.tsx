"use client";

import { IDKitWidget, VerificationLevel, ISuccessResult } from "@worldcoin/idkit";
import { useState } from "react";

interface WorldIDVerifyProps {
  onVerified: (proof: ISuccessResult) => void;
  buttonText?: string;
}

export function WorldIDVerify({ onVerified, buttonText = "Verify with World ID" }: WorldIDVerifyProps) {
  const [verified, setVerified] = useState(false);

  const handleSuccess = (result: ISuccessResult) => {
    setVerified(true);
    onVerified(result);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {!verified ? (
        <IDKitWidget
          app_id={process.env.NEXT_PUBLIC_WORLD_ID_APP_ID as `app_${string}`}
          action={process.env.NEXT_PUBLIC_WORLD_ID_ACTION || "sentinel_register"}
          verification_level={VerificationLevel.Device}
          onSuccess={handleSuccess}
        >
          {({ open }: any) => (
            <button
              type="button"
              onClick={open}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              {buttonText}
            </button>
          )}
        </IDKitWidget>
      ) : (
        <div className="flex items-center gap-2 text-green-400 font-medium">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Verified Human
        </div>
      )}
    </div>
  );
}
