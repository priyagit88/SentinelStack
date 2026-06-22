import crypto from "crypto";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { customSession, magicLink, emailOTP, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { Resend } from "resend";
import { MongoClient } from "mongodb";
import { mongoUri } from "@/lib/db";
import {
  analyzeImpossibleTravel,
  flagUser,
  getClientIp,
  recordSecurityEvent,
  resolveIpLocation,
  userAgentToDevice
} from "@/lib/security";
import { User } from "@/lib/models/user";
import { connectMongoose } from "@/lib/db";
import mongoose from "mongoose";

if (process.env.BETTER_AUTH_URL) {
  let url = process.env.BETTER_AUTH_URL.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  process.env.BETTER_AUTH_URL = url;
} else {
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
}

const client = new MongoClient(mongoUri);
const db = client.db();

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

// AUTH FIX: explicit baseURL drives the OAuth redirect_uri sent to Google/GitHub.
// Must equal the value registered in those providers' admin consoles.
// In Vercel production this MUST be set to https://sentinel-stack-seven.vercel.app.
const isProduction = process.env.NODE_ENV === "production";
const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

// AUTH FIX: only register a social provider when both creds are present.
// Avoids better-auth registering Google/GitHub with empty strings, which
// causes confusing "missing client_id" failures at the provider.
const socialProviders: {
  github?: { clientId: string; clientSecret: string };
  google?: { clientId: string; clientSecret: string };
} = {};
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET
  };
}
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET
  };
}

const baseAuthOptions = {
  database: mongodbAdapter(db, {
    client
  }),
  baseURL,
  // AUTH FIX: trustedOrigins safeguards /api/auth/* against requests from
  // unexpected origins. Includes BETTER_AUTH_URL plus the production URL
  // explicitly so preview deployments and direct host overrides still work.
  trustedOrigins: [
    baseURL,
    "https://sentinel-stack-seven.vercel.app",
    "http://localhost:3000"
  ].filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i) as string[],
  // AUTH FIX: harden every cookie better-auth issues (session, CSRF, OAuth
  // state, 2fa_challenge). HttpOnly blocks JS access (XSS mitigation), Secure
  // forces HTTPS in production, SameSite=Lax keeps OAuth working — Strict
  // would drop the state cookie on the Google/GitHub return hop and break
  // social login entirely.
  advanced: {
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      path: "/"
    }
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      try {
        const { data, error } = await resend.emails.send({
          from: process.env.EMAIL_FROM || "SentinelStack Security <onboarding@resend.dev>",
          to: user.email,
          subject: "Verify your SentinelStack Account",
          html: `<div style="background:#0f172a;color:#fff;padding:20px;font-family:sans-serif;text-align:center;">
                   <h2>Welcome to SentinelStack, ${user.name}!</h2>
                   <p>Please verify your email address to activate your security dashboard.</p>
                   <br/>
                   <a href="${url}" style="background:#06b6d4;color:#000;padding:12px 24px;text-decoration:none;border-radius:5px;font-weight:bold;">Verify Email</a>
                 </div>`
        });
        if (error) {
          console.error("[resend] Failed to send verification email:", error);
        } else {
          console.log("[resend] Verification email sent successfully:", data);
        }
      } catch (error) {
        console.error("[resend] Exception sending verification email:", error);
      }
    }
  },
  socialProviders,
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"]
    }
  },
  user: {
    deleteUser: {
      enabled: true
    },
    additionalFields: {
      isFlagged: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false
      },
      riskScore: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false
      },
      isBlocked: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false
      }
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    additionalFields: {
      location: {
        type: "json",
        required: false,
        defaultValue: null,
        input: false
      }
    }
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session, ctx) => {
          await connectMongoose();
          const blockedUser = await User.findOne({
            $or: [
              { id: session.userId },
              { _id: mongoose.Types.ObjectId.isValid(String(session.userId)) ? new mongoose.Types.ObjectId(String(session.userId)) : null }
            ]
          }).select("isBlocked").lean<{ isBlocked?: boolean } | null>();

          if (blockedUser?.isBlocked) {
            throw new Error("Your account has been blocked by an administrator for security violations.");
          }

          // OAuth 2FA enforcement: if a session is being created via the OAuth
          // callback (/callback/:provider or /oauth2/callback/:provider) for a
          // user that already has TOTP enabled, abort the session creation and
          // redirect to /two-factor with a fresh challenge cookie. better-auth's
          // twoFactor plugin only hooks /sign-in/email, so without this hook
          // Google/GitHub OAuth would silently bypass 2FA.
          //
          // The email-login path is unaffected (path doesn't start with /callback/)
          // and the post-verifyTotp session creation is unaffected (its path is
          // /two-factor/verify-totp).
          const ctxPath = (ctx as { path?: string } | null)?.path;
          const ctxFull = ctx as unknown as
            | {
                path?: string;
                context?: {
                  internalAdapter?: {
                    findUserById: (
                      id: string
                    ) => Promise<{ id: string; twoFactorEnabled?: boolean } | null>;
                    createVerificationValue: (data: {
                      value: string;
                      identifier: string;
                      expiresAt: Date;
                    }) => Promise<unknown>;
                  };
                  createAuthCookie?: (
                    name: string,
                    overrides?: Record<string, unknown>
                  ) => { name: string; attributes: Record<string, unknown> };
                  secret?: string;
                };
                setSignedCookie?: (
                  name: string,
                  value: string,
                  secret: string,
                  attrs: Record<string, unknown>
                ) => Promise<void>;
                setCookie?: (
                  name: string,
                  value: string,
                  attrs: Record<string, unknown>
                ) => void;
                redirect?: (url: string) => Error;
              }
            | null;
          const isOauthCallback =
            typeof ctxPath === "string" &&
            (ctxPath.startsWith("/callback/") || ctxPath.startsWith("/oauth2/callback/"));
          if (
            isOauthCallback &&
            ctxFull?.context?.internalAdapter &&
            ctxFull.context.createAuthCookie &&
            ctxFull.context.secret &&
            ctxFull.setSignedCookie &&
            ctxFull.setCookie &&
            ctxFull.redirect
          ) {
            const user = await ctxFull.context.internalAdapter.findUserById(
              String(session.userId ?? "")
            );
            if (user?.twoFactorEnabled === true) {
              const maxAge = 3 * 60;
              const twoFactorCookieAttrs = ctxFull.context.createAuthCookie(
                "two_factor",
                { maxAge }
              );
              const identifier = `2fa-${crypto.randomBytes(15).toString("hex")}`;
              await ctxFull.context.internalAdapter.createVerificationValue({
                value: String(user.id),
                identifier,
                expiresAt: new Date(Date.now() + maxAge * 1000)
              });
              await ctxFull.setSignedCookie(
                twoFactorCookieAttrs.name,
                identifier,
                ctxFull.context.secret,
                twoFactorCookieAttrs.attributes
              );
              // Defense-in-depth: expire trust_device cookies on the OAuth
              // response so any pre-existing trust cookie in the browser is
              // dropped; same protection the email-login route applies.
              ctxFull.setCookie("better-auth.trust_device", "", {
                maxAge: 0,
                path: "/",
                httpOnly: true,
                sameSite: "lax"
              });
              ctxFull.setCookie("__Secure-better-auth.trust_device", "", {
                maxAge: 0,
                path: "/",
                httpOnly: true,
                sameSite: "lax",
                secure: true
              });
              throw ctxFull.redirect("/two-factor");
            }
          }

          const context = (ctx as { context?: { headers?: Headers } } | null)?.context;
          let ipAddress = typeof session.ipAddress === "string" && session.ipAddress ? session.ipAddress : "127.0.0.1";
          let userAgent = session.userAgent ?? undefined;
          
          try {
            const { headers } = await import("next/headers");
            const reqHeaders = await headers();
            const forwarded = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
            const realIp = reqHeaders.get("x-real-ip")?.trim();
            if (forwarded || realIp) {
               ipAddress = forwarded || realIp || ipAddress;
            }
            if (reqHeaders.get("user-agent")) {
               userAgent = reqHeaders.get("user-agent") ?? undefined;
            }
          } catch (e) {
            // Fallback if not in a request context
          }
          
          const location = await resolveIpLocation(ipAddress);
          if (location.realIp) {
             ipAddress = location.realIp;
          }
          const userId = String(session.userId ?? "");

          if (userId) {
            const travel = await analyzeImpossibleTravel({
              userId,
              ipAddress,
              userAgent,
              location
            });

            if (travel.impossible) {
              await flagUser(userId, 45);
              await recordSecurityEvent({
                userId,
                type: "IMPOSSIBLE_TRAVEL",
                severity: "CRITICAL",
                details: `Login implied ${Math.round(travel.speedKmh)} km/h over ${Math.round(
                  travel.distanceKm
                )} km from ${travel.previous?.location?.city ?? "unknown"} to ${
                  location.city ?? "unknown"
                }.`,
                ip: ipAddress,
                metadata: {
                  currentLocation: location,
                  previousLocation: travel.previous?.location,
                  previousSessionId: travel.previous?.id ?? travel.previous?._id?.toString(),
                  speedKmh: travel.speedKmh,
                  distanceKm: travel.distanceKm,
                  hoursElapsed: travel.hoursElapsed,
                  device: userAgentToDevice(userAgent)
                },
                runAi: true
              });
            }
          }

          return {
            data: {
              ...session,
              ipAddress,
              userAgent: userAgent ?? session.userAgent ?? null,
              location
            }
          };
        },
        after: async (session: any) => {
          await recordSecurityEvent({
            userId: String(session.userId),
            type: "LOGIN_SUCCESS",
            severity: "LOW",
            details: `Successful authentication from ${session.ipAddress}.`,
            ip: session.ipAddress ?? "0.0.0.0",
            metadata: {
              device: userAgentToDevice(session.userAgent ?? undefined),
              userAgent: session.userAgent
            },
            runAi: true
          });
        }
      },
      delete: {
        after: async (session: any) => {
          await recordSecurityEvent({
            userId: String(session.userId),
            type: "SESSION_REVOKED",
            severity: "LOW",
            details: `Session revoked for ${session.ipAddress}.`,
            ip: session.ipAddress ?? "0.0.0.0",
            runAi: true
          });
        }
      }
    },
    user: {
      create: {
        after: async (user: any) => {
          await recordSecurityEvent({
            userId: String(user.id),
            type: "REGISTER_SUCCESS",
            severity: "LOW",
            details: `New account created: ${user.email}.`,
            ip: "0.0.0.0", // IP might not be available here, but we can try to extract it if needed
            metadata: {
              email: user.email,
              name: user.name
            },
            runAi: true
          });
        }
      },
      delete: {
        after: async (user: any) => {
          await connectMongoose();
          const userIdStr = String(user.id);
          const userIdObj = mongoose.Types.ObjectId.isValid(userIdStr) 
            ? new mongoose.Types.ObjectId(userIdStr) 
            : null;
          
          const dbInstance = (await connectMongoose()).connection.db;
          if (dbInstance) {
             const userIds = [userIdStr, userIdObj].filter(Boolean);
             await Promise.all([
               dbInstance.collection("account").deleteMany({ userId: { $in: userIds } }),
               dbInstance.collection("session").deleteMany({ userId: { $in: userIds } }),
               dbInstance.collection("securityLog").deleteMany({ userId: { $in: userIds } })
             ]);
          }
        }
      }
    }
  }
} satisfies BetterAuthOptions;

const authOptions = {
  ...baseAuthOptions,
  plugins: [
    customSession(async ({ user, session }) => {
      await connectMongoose();
      const persisted = await User.findOne({
        $or: [{ id: user.id }, { email: user.email }]
      })
        .select("isFlagged riskScore")
        .lean<{ isFlagged?: boolean; riskScore?: number } | null>();

      return {
        user: {
          ...user,
          isFlagged: Boolean(persisted?.isFlagged ?? (user as { isFlagged?: boolean }).isFlagged),
          riskScore: Number(persisted?.riskScore ?? (user as { riskScore?: number }).riskScore ?? 0)
        },
        session
      };
    }, baseAuthOptions),
    nextCookies(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        try {
          const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || "SentinelStack Security <onboarding@resend.dev>",
            to: email,
            subject: "Your SentinelStack Magic Link",
            html: `<div style="background:#0f172a;color:#fff;padding:20px;font-family:sans-serif;text-align:center;">
                     <h2>Secure Sign-In</h2>
                     <p>Click the link below to securely sign into SentinelStack.</p>
                     <br/>
                     <a href="${url}" style="background:#06b6d4;color:#000;padding:12px 24px;text-decoration:none;border-radius:5px;font-weight:bold;">Sign In with Magic Link</a>
                     <p style="margin-top:20px;font-size:12px;color:#94a3b8;">This link expires shortly and can only be used once.</p>
                   </div>`
          });
          if (error) {
            console.error("[resend] Failed to send magic link:", error);
          } else {
            console.log("[resend] Magic link sent successfully:", data);
          }
        } catch (error) {
          console.error("[resend] Exception sending magic link:", error);
        }
      }
    }),
    twoFactor({
      issuer: "SentinelStack",
      skipVerificationOnEnable: false
    }),
    // Passkey (WebAuthn) as a phishing-resistant MFA / passwordless sign-in
    // method. rpID and origin are pinned to the canonical baseURL host so
    // registration and authentication agree on the relying party. In dev this
    // resolves to localhost; in production to the Vercel host.
    passkey({
      rpName: "SentinelStack",
      rpID: new URL(baseURL).hostname,
      origin: baseURL
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        try {
          const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || "SentinelStack Security <onboarding@resend.dev>",
            to: email,
            subject: "Your SentinelStack Security Passcode",
            html: `<div style="background:#0f172a;color:#fff;padding:20px;font-family:sans-serif;text-align:center;">
                     <h2>One-Time Passcode</h2>
                     <p>Use the following 6-digit code to verify your identity.</p>
                     <div style="background:#1e293b;color:#22d3ee;padding:15px;font-size:28px;letter-spacing:6px;font-weight:bold;border-radius:5px;margin:20px auto;max-width:200px;">${otp}</div>
                     <p style="font-size:12px;color:#94a3b8;">Do not share this code with anyone.</p>
                   </div>`
          });
          if (error) {
            console.error("[resend] Failed to send OTP:", error);
          } else {
            console.log("[resend] OTP sent successfully:", data);
          }
        } catch (error) {
          console.error("[resend] Exception sending OTP:", error);
        }
      }
    })
  ]
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);

export type AuthSession = typeof auth.$Infer.Session;
