"use client";

import { createAuthClient } from "better-auth/react";
import {
  customSessionClient,
  magicLinkClient,
  emailOTPClient,
  twoFactorClient
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    customSessionClient(),
    magicLinkClient(),
    emailOTPClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/two-factor";
      }
    })
  ]
});
