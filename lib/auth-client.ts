"use client";

import { createAuthClient } from "better-auth/react";
import {
  customSessionClient,
  magicLinkClient,
  emailOTPClient,
  twoFactorClient
} from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [
    customSessionClient<typeof auth>(),
    magicLinkClient(),
    emailOTPClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/two-factor";
      }
    })
  ]
});
