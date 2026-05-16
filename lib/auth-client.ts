"use client";

import { createAuthClient } from "better-auth/react";
import { customSessionClient, magicLinkClient, emailOTPClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [
    customSessionClient<typeof auth>(),
    magicLinkClient(),
    emailOTPClient()
  ]
});
