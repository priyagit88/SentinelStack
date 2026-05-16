import mongoose from "mongoose";
import { headers } from "next/headers";
import { connectMongoose } from "@/lib/db";
import { SecurityLog, type Severity } from "@/lib/models/security-log";
import { Session, type GeoLocation, type SentinelSession } from "@/lib/models/session";
import { User } from "@/lib/models/user";
import { analyzeThreatWithGemini } from "@/lib/threat-ai";

export type LoginContext = {
  userId: string;
  ipAddress: string;
  userAgent?: string;
  location: GeoLocation;
};

export type TravelAnalysis = {
  previous?: SentinelSession | null;
  distanceKm: number;
  hoursElapsed: number;
  speedKmh: number;
  impossible: boolean;
};

const LOCAL_LOCATIONS: Record<string, GeoLocation> = {
  "127.0.0.1": { lat: 12.9716, lon: 77.5946, city: "Bengaluru", country: "India" },
  "::1": { lat: 12.9716, lon: 77.5946, city: "Bengaluru", country: "India" },
  "10.0.0.1": { lat: 40.7128, lon: -74.006, city: "New York", country: "United States" },
  "10.0.0.2": { lat: 51.5072, lon: -0.1276, city: "London", country: "United Kingdom" }
};

export function getClientIp(headerBag: Headers) {
  const forwarded = headerBag.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerBag.get("x-real-ip")?.trim();
  return forwarded || realIp || "127.0.0.1";
}

export function userAgentToDevice(userAgent = "Unknown device") {
  const lower = userAgent.toLowerCase();
  const browser = lower.includes("edg")
    ? "Edge"
    : lower.includes("chrome")
      ? "Chrome"
      : lower.includes("firefox")
        ? "Firefox"
        : lower.includes("safari")
          ? "Safari"
          : "Browser";
  const os = lower.includes("windows")
    ? "Windows"
    : lower.includes("mac os")
      ? "macOS"
      : lower.includes("iphone")
        ? "iOS"
        : lower.includes("android")
          ? "Android"
          : lower.includes("linux")
            ? "Linux"
            : "Unknown OS";

  return `${browser} on ${os}`;
}

export async function resolveIpLocation(ipAddress: string): Promise<GeoLocation> {
  const normalized = ipAddress.replace("::ffff:", "");
  if (
    LOCAL_LOCATIONS[normalized] ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("172.16.")
  ) {
    return LOCAL_LOCATIONS[normalized] ?? LOCAL_LOCATIONS["127.0.0.1"];
  }

  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(normalized)}?fields=status,country,city,lat,lon`,
      { next: { revalidate: 3600 } }
    );
    const data = (await response.json()) as {
      status?: string;
      country?: string;
      city?: string;
      lat?: number;
      lon?: number;
    };

    if (data.status === "success" && typeof data.lat === "number" && typeof data.lon === "number") {
      return {
        lat: data.lat,
        lon: data.lon,
        city: data.city ?? "Unknown",
        country: data.country ?? "Unknown"
      };
    }
  } catch {
    // Local development and restricted networks fall back to a stable realistic coordinate.
  }

  return LOCAL_LOCATIONS["127.0.0.1"];
}

export function haversineKm(a: GeoLocation, b: GeoLocation) {
  if (
    typeof a.lat !== "number" ||
    typeof a.lon !== "number" ||
    typeof b.lat !== "number" ||
    typeof b.lon !== "number"
  ) {
    return 0;
  }

  const radiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

export async function analyzeImpossibleTravel(ctx: LoginContext): Promise<TravelAnalysis> {
  await connectMongoose();

  const previous = await Session.findOne({
    userId: ctx.userId,
    "location.lat": { $type: "number" },
    "location.lon": { $type: "number" }
  })
    .sort({ createdAt: -1 })
    .lean<SentinelSession | null>();

  if (!previous?.location || !previous.createdAt) {
    return { previous, distanceKm: 0, hoursElapsed: 0, speedKmh: 0, impossible: false };
  }

  const distanceKm = haversineKm(previous.location, ctx.location);
  const hoursElapsed = Math.max((Date.now() - new Date(previous.createdAt).getTime()) / 36e5, 1 / 60);
  const speedKmh = distanceKm / hoursElapsed;

  return {
    previous,
    distanceKm,
    hoursElapsed,
    speedKmh,
    impossible: speedKmh > 800
  };
}

export async function recordSecurityEvent(args: {
  userId?: string | mongoose.Types.ObjectId | null;
  type: string;
  severity: Severity;
  details: string;
  ip: string;
  metadata?: Record<string, unknown>;
  runAi?: boolean;
}) {
  await connectMongoose();

  const objectId =
    typeof args.userId === "string" && mongoose.Types.ObjectId.isValid(args.userId)
      ? new mongoose.Types.ObjectId(args.userId)
      : args.userId instanceof mongoose.Types.ObjectId
        ? args.userId
        : null;

  const log = await SecurityLog.create({
    userId: objectId,
    type: args.type,
    severity: args.severity,
    details: args.details,
    ip: args.ip,
    metadata: args.metadata ?? {},
    aiAnalysis: null
  });

  if (args.runAi && (args.severity === "HIGH" || args.severity === "CRITICAL")) {
    const aiAnalysis = await analyzeThreatWithGemini({
      event: {
        type: args.type,
        severity: args.severity,
        details: args.details,
        ip: args.ip,
        metadata: args.metadata ?? {}
      },
      userId: typeof args.userId === "string" ? args.userId : undefined
    });

    log.aiAnalysis = aiAnalysis;
    await log.save();
  }

  return log;
}

export async function flagUser(userId: string, riskDelta: number) {
  await connectMongoose();
  await User.updateOne(
    { $or: [{ id: userId }, { _id: mongoose.Types.ObjectId.isValid(userId) ? userId : undefined }] },
    { $set: { isFlagged: true }, $inc: { riskScore: riskDelta } }
  );
}

export async function buildRequestLoginContext(userId: string) {
  const headerBag = await headers();
  const ipAddress = getClientIp(headerBag);
  const location = await resolveIpLocation(ipAddress);

  return {
    userId,
    ipAddress,
    userAgent: headerBag.get("user-agent") ?? undefined,
    location
  };
}
