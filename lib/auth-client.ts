"use client";

import { createAuthClient } from "better-auth/react";
import {
  customSessionClient,
  magicLinkClient,
  emailOTPClient,
  twoFactorClient
} from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [
    customSessionClient(),
    magicLinkClient(),
    emailOTPClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/two-factor";
      }
    }),
    passkeyClient()
  ]
});
