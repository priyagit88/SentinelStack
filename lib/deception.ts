import { connectMongoose } from "@/lib/db";
import { HoneyLog } from "@/lib/models/honey-log";

// ─── Constants ────────────────────────────────────────────────────────────────

export const DECEPTION_COOKIE   = "sentinel-deception-mode";
export const DECEPTION_THRESHOLD = 80; // AI confidence % at which deception fires
export const DECEPTION_TTL_SEC  = 3600; // 1 hour

// ─── Session Helpers ──────────────────────────────────────────────────────────

/**
 * Reads the honeypot session token from a Headers object.
 * Returns null if the cookie is absent.
 */
export function getDeceptionToken(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name?.trim() === DECEPTION_COOKIE) {
      return rest.join("=").trim() || null;
    }
  }
  return null;
}

/**
 * Returns true if the request carries a valid deception session cookie.
 */
export function isDeceptionSession(headers: Headers): boolean {
  return getDeceptionToken(headers) !== null;
}

// ─── Logging ─────────────────────────────────────────────────────────────────

export async function logHoneyAction(args: {
  sessionToken: string;
  userEmail: string;
  ipAddress: string;
  userAgent?: string;
  location?: { lat?: number; lon?: number; city?: string; country?: string };
  action: string;
  payload?: Record<string, unknown>;
  aiConfidenceScore?: number;
  aiSummary?: string;
}) {
  await connectMongoose();
  return HoneyLog.create({
    sessionToken:      args.sessionToken,
    userEmail:         args.userEmail,
    ipAddress:         args.ipAddress,
    userAgent:         args.userAgent,
    location:          args.location,
    action:            args.action,
    payload:           args.payload ?? {},
    aiConfidenceScore: args.aiConfidenceScore,
    aiSummary:         args.aiSummary,
    timestamp:         new Date()
  });
}

// ─── Fake Data Generators ─────────────────────────────────────────────────────

const FAKE_NAMES   = ["Alex Morgan", "Jordan Lee", "Sam Rivera", "Taylor Chen", "Casey Kim"];
const FAKE_EMAILS  = ["a.morgan@mail.com", "j.lee@mail.com", "s.rivera@mail.com", "t.chen@mail.com", "c.kim@mail.com"];
const FAKE_COURSES = ["Introduction to Cybersecurity", "Data Structures & Algorithms", "Cloud Computing 101", "Digital Marketing Fundamentals", "Machine Learning Basics"];
const FAKE_EVENTS  = ["Annual Tech Fest 2026", "Hackathon Spring", "Campus Clean-Up Drive", "Photography Workshop", "Career Fair 2026"];
const FAKE_FEED = [
  { action: "Enrolled in 'Cloud Computing 101'", time: "2 hours ago" },
  { action: "Registered for 'Annual Tech Fest 2026'", time: "1 day ago" },
  { action: "Completed quiz in 'Data Structures'", time: "3 days ago" },
  { action: "Profile updated", time: "5 days ago" },
  { action: "Password changed successfully", time: "1 week ago" }
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getFakeProfile(seed: string) {
  // Deterministic from seed so multiple requests in the same session are consistent
  const idx = seed.charCodeAt(0) % FAKE_NAMES.length;
  return {
    name:           FAKE_NAMES[idx],
    email:          FAKE_EMAILS[idx],
    joinedDate:     "January 15, 2025",
    enrolledCourses: FAKE_COURSES.slice(0, 3),
    upcomingEvents:  FAKE_EVENTS.slice(0, 2),
    recentActivity:  FAKE_FEED,
    stats: {
      coursesEnrolled: 3,
      eventsAttended:  7,
      quizzesPassed:   12,
      profileViews:    48
    }
  };
}

export function getFakeStats() {
  return {
    totalUsers:      12847,
    activeToday:     1204,
    coursesLive:     189,
    upcomingEvents:  34
  };
}

export function getFakeActivityFeed() {
  return [
    { user: "Alex M.", event: "Enrolled in Cloud Computing 101", time: "Just now" },
    { user: "Jordan L.", event: "Registered for Tech Fest 2026", time: "3 min ago" },
    { user: "Sam R.", event: "Completed Cybersecurity Quiz", time: "10 min ago" },
    { user: "Taylor C.", event: "Posted in ML Basics forum", time: "22 min ago" },
    { user: "Casey K.", event: "Downloaded course materials", time: "1 hr ago" }
  ];
}
