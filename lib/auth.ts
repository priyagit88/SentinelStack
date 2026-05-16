import { betterAuth, type BetterAuthOptions } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { customSession, magicLink, emailOTP } from "better-auth/plugins";
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

const client = new MongoClient(mongoUri);
const db = client.db();

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

const baseAuthOptions = {
  database: mongodbAdapter(db, {
    client
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      try {
        await resend.emails.send({
          from: "SentinelStack Security <onboarding@resend.dev>",
          to: user.email,
          subject: "Verify your SentinelStack Account",
          html: `<div style="background:#0f172a;color:#fff;padding:20px;font-family:sans-serif;text-align:center;">
                   <h2>Welcome to SentinelStack, ${user.name}!</h2>
                   <p>Please verify your email address to activate your security dashboard.</p>
                   <br/>
                   <a href="${url}" style="background:#06b6d4;color:#000;padding:12px 24px;text-decoration:none;border-radius:5px;font-weight:bold;">Verify Email</a>
                 </div>`
        });
      } catch (error) {
        console.error("Failed to send verification email:", error);
      }
    }
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || ""
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || ""
    }
  },
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
        after: async (session) => {
          await recordSecurityEvent({
            userId: String(session.userId),
            type: "LOGIN_SUCCESS",
            severity: "LOW",
            details: `Successful authentication from ${session.ipAddress}.`,
            ip: session.ipAddress ?? "0.0.0.0",
            metadata: {
              device: userAgentToDevice(session.userAgent ?? undefined),
              userAgent: session.userAgent
            }
          });
        },
      },
      delete: {
        after: async (session: { userId: string | number; ipAddress?: string | null }) => {
          await recordSecurityEvent({
            userId: String(session.userId),
            type: "SESSION_REVOKED",
            severity: "LOW",
            details: `Session revoked for ${session.ipAddress}.`,
            ip: session.ipAddress ?? "0.0.0.0"
          });
        }
      }
    },
    user: {
      create: {
        after: async (user) => {
          await recordSecurityEvent({
            userId: String(user.id),
            type: "REGISTER_SUCCESS",
            severity: "LOW",
            details: `New account created: ${user.email}.`,
            ip: "0.0.0.0", // IP might not be available here, but we can try to extract it if needed
            metadata: {
              email: user.email,
              name: user.name
            }
          });
        }
      },
      delete: {
        after: async (user) => {
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
          await resend.emails.send({
            from: "SentinelStack Security <onboarding@resend.dev>",
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
        } catch (error) {
          console.error("Failed to send magic link:", error);
        }
      }
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        try {
          await resend.emails.send({
            from: "SentinelStack Security <onboarding@resend.dev>",
            to: email,
            subject: "Your SentinelStack Security Passcode",
            html: `<div style="background:#0f172a;color:#fff;padding:20px;font-family:sans-serif;text-align:center;">
                     <h2>One-Time Passcode</h2>
                     <p>Use the following 6-digit code to verify your identity.</p>
                     <div style="background:#1e293b;color:#22d3ee;padding:15px;font-size:28px;letter-spacing:6px;font-weight:bold;border-radius:5px;margin:20px auto;max-width:200px;">${otp}</div>
                     <p style="font-size:12px;color:#94a3b8;">Do not share this code with anyone.</p>
                   </div>`
          });
        } catch (error) {
          console.error("Failed to send OTP:", error);
        }
      }
    })
  ]
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);

export type AuthSession = typeof auth.$Infer.Session;
