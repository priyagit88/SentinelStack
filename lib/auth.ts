import { betterAuth, type BetterAuthOptions } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { customSession } from "better-auth/plugins";
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

const client = new MongoClient(mongoUri);
const db = client.db();

const baseAuthOptions = {
  database: mongodbAdapter(db, {
    client
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false
  },
  user: {
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
          const headerBag = context?.headers;
          const ipAddress =
            headerBag instanceof Headers
              ? getClientIp(headerBag)
              : typeof session.ipAddress === "string"
                ? session.ipAddress
                : "127.0.0.1";
          const userAgent =
            headerBag instanceof Headers ? (headerBag.get("user-agent") ?? undefined) : undefined;
          const location = await resolveIpLocation(ipAddress);
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
    nextCookies()
  ]
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);

export type AuthSession = typeof auth.$Infer.Session;
